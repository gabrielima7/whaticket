import { Op } from "sequelize";
import TicketTraking from "./models/TicketTraking";
import Ticket from "./models/Ticket";
import Whatsapp from "./models/Whatsapp";
import { getIO } from "./libs/socket";
import { logger } from "./utils/logger";
import ShowTicketService from "./services/TicketServices/ShowTicketService";

export const TransferTicketQueue = async (): Promise<void> => {
  const io = getIO();

  // Buscar os tickets que estão pendentes e sem fila
  const tickets = await Ticket.findAll({
    where: {
      status: "pending",
      queueId: {
        [Op.is]: null
      }
    }
  });

  // Varrer os tickets sequencialmente com isolamento de erro e verificar se algum deles está com o tempo estourado
  for (const ticket of tickets) {
    try {
      if (!ticket.whatsappId) continue;

      const wpp = await Whatsapp.findOne({
        where: {
          id: ticket.whatsappId
        }
      });

      if (
        !wpp ||
        !wpp.timeToTransfer ||
        !wpp.transferQueueId ||
        wpp.timeToTransfer == 0
      ) {
        continue;
      }

      const dataLimite = new Date(ticket.updatedAt);
      dataLimite.setMinutes(dataLimite.getMinutes() + wpp.timeToTransfer);

      if (new Date() > dataLimite) {
        await ticket.update({
          queueId: wpp.transferQueueId
        });

        const ticketTraking = await TicketTraking.findOne({
          where: {
            ticketId: ticket.id
          },
          order: [["createdAt", "DESC"]]
        });

        if (ticketTraking) {
          await ticketTraking.update({
            queuedAt: new Date(),
            queueId: wpp.transferQueueId
          } as any);
        }

        const currentTicket = await ShowTicketService(
          ticket.id,
          ticket.companyId
        );

        io.to(`company-${ticket.companyId}-${ticket.status}`)
          .to(`company-${ticket.companyId}-notification`)
          .to(`queue-${wpp.transferQueueId}-${ticket.status}`)
          .to(`queue-${wpp.transferQueueId}-notification`)
          .to(ticket.id.toString())
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "update",
            ticket: currentTicket,
            traking: "created ticket 33"
          });

        logger.info(
          `Transferencia de ticket automatica ticket id ${ticket.id} para a fila ${wpp.transferQueueId}`
        );
      }
    } catch (err: any) {
      logger.error(
        `Erro ao transferir ticket ${ticket.id} automaticamente: ${err?.message}`
      );
    }
  }
};
