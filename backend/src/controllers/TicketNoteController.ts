import * as Yup from "yup";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketNote from "../models/TicketNote";
import Ticket from "../models/Ticket";

import ListTicketNotesService from "../services/TicketNoteService/ListTicketNotesService";
import CreateTicketNoteService from "../services/TicketNoteService/CreateTicketNoteService";
import UpdateTicketNoteService from "../services/TicketNoteService/UpdateTicketNoteService";
import ShowTicketNoteService from "../services/TicketNoteService/ShowTicketNoteService";
import FindAllTicketNotesService from "../services/TicketNoteService/FindAllTicketNotesService";
import DeleteTicketNoteService from "../services/TicketNoteService/DeleteTicketNoteService";
import FindNotesByContactIdAndTicketId from "../services/TicketNoteService/FindNotesByContactIdAndTicketId";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type StoreTicketNoteData = {
  note: string;
  userId: number;
  contactId: number | 0;
  ticketId: number | 0;
  id?: number | string;
};

type UpdateTicketNoteData = {
  note: string;
  id?: number | string;
  userId?: number | 0;
  contactId?: number | 0;
  ticketId?: number | 0;
};

type QueryFilteredNotes = {
  contactId: number | string;
  ticketId: number | string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { ticketNotes, count, hasMore } = await ListTicketNotesService({
    searchParam,
    pageNumber
  });

  return res.json({ ticketNotes, count, hasMore });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const ticketNotes: TicketNote[] = await FindAllTicketNotesService(companyId);

  return res.status(200).json(ticketNotes);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newTicketNote: StoreTicketNoteData = req.body;
  const { id: userId, companyId } = req.user;

  const schema = Yup.object().shape({
    note: Yup.string().required(),
    ticketId: Yup.number().required()
  });

  try {
    await schema.validate(newTicketNote);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const ticket = await Ticket.findOne({
    where: { id: newTicketNote.ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("Ticket não encontrado", 404);
  }

  const ticketNote = await CreateTicketNoteService({
    ...newTicketNote,
    userId
  });

  return res.status(200).json(ticketNote);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const ticketNote = await ShowTicketNoteService(id);
  if (!ticketNote) {
    throw new AppError("Observação não encontrada", 404);
  }

  const ticket = await Ticket.findOne({
    where: { id: ticketNote.ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return res.status(200).json(ticketNote);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ticketNote: UpdateTicketNoteData = req.body;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    note: Yup.string()
  });

  try {
    await schema.validate(ticketNote);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const currentNote = await ShowTicketNoteService(ticketNote.id as any);
  if (!currentNote) {
    throw new AppError("Observação não encontrada", 404);
  }

  const ticket = await Ticket.findOne({
    where: { id: currentNote.ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const recordUpdated = await UpdateTicketNoteService(ticketNote);

  return res.status(200).json(recordUpdated);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const currentNote = await ShowTicketNoteService(id);
  if (!currentNote) {
    throw new AppError("Observação não encontrada", 404);
  }

  const ticket = await Ticket.findOne({
    where: { id: currentNote.ticketId, companyId }
  });
  if (!ticket) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await DeleteTicketNoteService(id);

  return res.status(200).json({ message: "Observação removida" });
};

export const findFilteredList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { contactId, ticketId } = req.query as QueryFilteredNotes;
    const { companyId } = req.user;

    if (ticketId) {
      const ticket = await Ticket.findOne({
        where: { id: ticketId, companyId }
      });
      if (!ticket) {
        throw new AppError("Ticket não encontrado", 404);
      }
    }

    const notes: TicketNote[] = await FindNotesByContactIdAndTicketId({
      contactId,
      ticketId
    });

    return res.status(200).json(notes);
  } catch (e: any) {
    if (e instanceof AppError) {
      return res.status(e.statusCode).json({ message: e.message });
    }
    return res.status(500).json({ message: e.message || e });
  }
};
