import TicketNote from "../../models/TicketNote";
import Ticket from "../../models/Ticket";

const FindAllTicketNotesService = async (companyId?: number): Promise<TicketNote[]> => {
  const include = companyId
    ? [{ model: Ticket, as: "ticket", where: { companyId }, attributes: [] }]
    : [];
  const ticketNote = await TicketNote.findAll({ include });
  return ticketNote;
};

export default FindAllTicketNotesService;
