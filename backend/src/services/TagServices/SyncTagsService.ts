import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";

interface Request {
  tags: Tag[];
  ticketId: number;
  companyId?: number;
}

const SyncTags = async ({
  tags,
  ticketId,
  companyId
}: Request): Promise<Ticket | null> => {
  const whereCondition: Record<string, any> = { id: ticketId };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const ticket = await Ticket.findOne({
    where: whereCondition,
    include: [Tag]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const safeTags = Array.isArray(tags) ? tags : [];
  const tagList = safeTags.map(t => ({ tagId: t.id, ticketId }));

  await TicketTag.destroy({ where: { ticketId } });
  if (tagList.length > 0) {
    await TicketTag.bulkCreate(tagList);
  }

  await ticket.reload();

  return ticket;
};

export default SyncTags;
