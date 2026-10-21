import { proto, WASocket } from "libzapitu-rf";
// import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });

  // 1. Tentar marcar como lido no socket do WhatsApp (Baileys / libzapitu-rf) de forma defensiva
  try {
    const wbot = await GetTicketWbot(ticket);

    if (!ticket.contact) {
      await ticket.reload({ include: ["contact"] });
    }

    // ID-032: Usar findOne para obter apenas a última mensagem não lida
    const latestUnread = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    if (latestUnread && wbot) {
      let messageKey: proto.IMessageKey | undefined;

      // ID-032: Parse seguro do dataJson sem JSON.stringify redundante
      if (latestUnread.dataJson) {
        try {
          const parsed =
            typeof latestUnread.dataJson === "string"
              ? JSON.parse(latestUnread.dataJson)
              : latestUnread.dataJson;
          messageKey = parsed?.key;
        } catch (e) {
          logger.warn(`SetTicketMessagesAsRead: erro ao parsear dataJson da msg ${latestUnread.id}`);
        }
      }

      const remoteJid = `${ticket.contact.number}@${
        ticket.isGroup ? "g.us" : "s.whatsapp.net"
      }`;

      // ID-032: Garantir que a key esteja montada para que o Baileys marque como lida
      const key = messageKey || {
        remoteJid,
        id: latestUnread.id,
        fromMe: false
      };

      const lastMessages = {
        key
      } as proto.IWebMessageInfo & { key: proto.IMessageKey };

      if (typeof (wbot as any).readMessages === "function") {
        await (wbot as any).readMessages([key]);
      } else if (typeof (wbot as any).chatModify === "function") {
        await (wbot as any).chatModify(
          { markRead: true, lastMessages: [lastMessages] },
          key.remoteJid || remoteJid
        );
      }
    }
  } catch (err) {
    logger.warn(
      `SetTicketMessagesAsRead: Could not mark messages as read in whatsapp socket. Maybe session disconnected? Err: ${err}`
    );
  }

  // 2. Atualizar no banco de dados independentemente de oscilações ou erros no socket
  try {
    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
  } catch (err) {
    logger.error(`SetTicketMessagesAsRead: Error updating messages in database: ${err}`);
  }

  const io = getIO();
  io.to(`company-${ticket.companyId}-mainchannel`).emit(
    `company-${ticket.companyId}-ticket`,
    {
      action: "updateUnread",
      ticketId: ticket.id
    }
  );
};

export default SetTicketMessagesAsRead;
