import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketTag from '../models/TicketTag';
import Tag from '../models/Tag';
import Ticket from '../models/Ticket';

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, tagId } = req.params;
  const { companyId } = req.user;

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("Ticket não encontrado", 404);
  }

  const tag = await Tag.findOne({
    where: { id: tagId, companyId }
  });
  if (!tag) {
    throw new AppError("Tag não encontrada", 404);
  }

  try {
    const [ticketTag] = await TicketTag.findOrCreate({
      where: { ticketId: Number(ticketId), tagId: Number(tagId) }
    });
    return res.status(201).json(ticketTag);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to store ticket tag.' });
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("Ticket não encontrado", 404);
  }

  try {
    const ticketTags = await TicketTag.findAll({ where: { ticketId } });
    const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);

    const tagsWithKanbanOne = await Tag.findAll({
      where: {
        id: tagIds,
        companyId,
        kanban: 1,
      },
    });

    const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
    if (tagIdsWithKanbanOne && tagIdsWithKanbanOne.length > 0) {
      await TicketTag.destroy({ where: { ticketId, tagId: tagIdsWithKanbanOne } });
    }

    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove ticket tags.' });
  }
};
