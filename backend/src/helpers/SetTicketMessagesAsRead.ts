import { proto, WASocket } from "libzapitu-rf";
// import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });

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

    if (latestUnread) {
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
      if (!messageKey) {
        messageKey = {
          id: latestUnread.id,
          fromMe: false,
          remoteJid
        };
      }

      const messageToMark = {
        key: messageKey
      } as proto.IWebMessageInfo & { key: proto.IMessageKey };

      await (wbot as WASocket).chatModify(
        { markRead: true, lastMessages: [messageToMark] },
        remoteJid
      );
    }

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
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
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
