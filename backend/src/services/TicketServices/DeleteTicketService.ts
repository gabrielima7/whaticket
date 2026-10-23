import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import TicketTraking from "../../models/TicketTraking";

const DeleteTicketService = async (
  id: string,
  companyId?: number
): Promise<Ticket> => {
  const whereCondition: Record<string, any> = { id };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const ticket = await Ticket.findOne({
    where: whereCondition
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const tracking = await TicketTraking.findOne({
    where: { ticketId: ticket.id }
  });

  if (tracking) {
    tracking.finishedAt = new Date();
    await tracking.save();
  }

  await ticket.destroy();

  return ticket;
};

export default DeleteTicketService;
