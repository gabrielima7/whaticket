import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const ShowMessageService = async (messageId: string, companyId?: number): Promise<Message | undefined> => {
  const where: any = { id: messageId };
  if (companyId) {
    where.companyId = companyId;
  }

  const message = await Message.findOne({
    where,
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket"
      }
    ]
  });

  return message || undefined;
};

export const GetWhatsAppFromMessage = async (message: Message): Promise<number | null> => {
  const ticketId = message.ticketId;
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    return null;
  }
  return ticket.whatsappId;
};

export default ShowMessageService;
