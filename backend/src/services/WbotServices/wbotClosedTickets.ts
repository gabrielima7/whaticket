import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { getIO } from "../../libs/socket";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import { verifyMessage } from "./wbotMessageListener";
import TicketTraking from "../../models/TicketTraking";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";

export const ClosedAllOpenTickets = async (companyId: number): Promise<void> => {
  const closeTicket = async (ticket: any, body: any) => {
    await ticket.update({
      status: "closed",
      lastMessage: body,
      unreadMessages: 0,
      amountUseBotQueues: 0
    });
  };

  const io = getIO();
  try {
    // ID-039 & ID-042: Eager load contact e whatsapp em 1 query única, eliminando N+1
    const tickets = await Ticket.findAll({
      where: { status: "open", companyId },
      include: [
        {
          model: Contact,
          as: "contact"
        },
        {
          model: Whatsapp,
          as: "whatsapp"
        }
      ],
      order: [["updatedAt", "DESC"]]
    });

    for (const ticket of tickets) {
      const whatsapp = ticket.whatsapp;
      if (!whatsapp) continue;

      const { expiresInactiveMessage, expiresTicket } = whatsapp;

      if (
        expiresTicket &&
        expiresTicket !== "" &&
        expiresTicket !== "0" &&
        Number(expiresTicket) > 0
      ) {
        if (ticket.status === "open" && !ticket.isGroup) {
          const dataLimite = new Date();
          dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

          const dataUltimaInteracaoChamado = new Date(ticket.updatedAt);

          if (dataUltimaInteracaoChamado < dataLimite && ticket.fromMe) {
            const bodyExpiresMessageInactive = formatBody(
              `\u200e ${expiresInactiveMessage}`,
              ticket.contact
            );

            await closeTicket(ticket, bodyExpiresMessageInactive);

            if (expiresInactiveMessage && expiresInactiveMessage.trim() !== "") {
              const sentMessage = await SendWhatsAppMessage({
                body: bodyExpiresMessageInactive,
                ticket
              });

              await verifyMessage(sentMessage, ticket, ticket.contact);
            }

            const ticketTraking = await TicketTraking.findOne({
              where: {
                ticketId: ticket.id,
                finishedAt: null
              }
            });

            if (ticketTraking) {
              await ticketTraking.update({
                finishedAt: moment().toDate(),
                closedAt: moment().toDate(),
                whatsappId: ticket.whatsappId,
                userId: ticket.userId
              } as any);
            }

            // ID-004: Isolar sala de socket por empresa
            io.to(`company-${companyId}-open`).emit(`company-${companyId}-ticket`, {
              action: "delete",
              ticketId: ticket.id
            });
          }
        }
      }
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error(`ClosedAllOpenTickets error: ${e?.message}`, e);
  }
};
