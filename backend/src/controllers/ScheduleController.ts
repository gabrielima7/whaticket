import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { head } from "lodash";

import AppError from "../errors/AppError";

import CreateService from "../services/ScheduleServices/CreateService";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";
import Schedule from "../models/Schedule";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

const parseSchedulePayload = (body: any) => {
  if (!body) return {};
  if (typeof body.scheduleData === "string") {
    try {
      return JSON.parse(body.scheduleData);
    } catch {
      throw new AppError("Formato inválido em scheduleData", 400);
    }
  }
  if (typeof body.scheduleData === "object" && body.scheduleData !== null) {
    return body.scheduleData;
  }
  return body;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } =
    req.query as IndexQuery;
  const { companyId } = req.user;

  const { schedules, count, hasMore } = await ListService({
    searchParam,
    contactId,
    userId,
    pageNumber,
    companyId
  });

  return res.json({ schedules, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const formatInfo = parseSchedulePayload(req?.body);
  const files = req?.files as Express.Multer.File[];
  const file = head(files);

  const {
    body,
    sendAt,
    contactId,
    userId,
    geral,
    queueId,
    whatsappId,
    repeatEvery,
    selectDaysRecorrenci,
    repeatCount
  } = formatInfo;
  const { companyId } = req.user;

  const schedule = await CreateService({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    geral,
    queueId,
    whatsappId,
    mediaPath: file?.filename,
    mediaName: file?.originalname,
    repeatEvery,
    selectDaysRecorrenci,
    repeatCount
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-schedule`,
    {
      action: "create",
      schedule
    }
  );

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData = parseSchedulePayload(req?.body);
  const files = req?.files as Express.Multer.File[];
  const file = head(files);
  const { companyId } = req.user;

  const importAnexoSchedule = await Schedule.findOne({
    where: { id: scheduleId, companyId }
  });

  if (!importAnexoSchedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  const nextMediaPath =
    file?.filename !== undefined
      ? file.filename
      : importAnexoSchedule.getDataValue("mediaPath");
  const nextMediaName =
    file?.originalname !== undefined
      ? file.originalname
      : importAnexoSchedule.getDataValue("mediaName");

  if (file) {
    await importAnexoSchedule.update({
      mediaPath: nextMediaPath,
      mediaName: nextMediaName
    });
    await importAnexoSchedule.reload();
  }

  const schedule = await UpdateService({
    scheduleData,
    id: scheduleId,
    companyId,
    mediaPath: nextMediaPath,
    mediaName: nextMediaName
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-schedule`,
    {
      action: "update",
      schedule
    }
  );

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-schedule`,
    {
      action: "delete",
      scheduleId
    }
  );

  return res.status(200).json({ message: "Schedule deleted" });
};
