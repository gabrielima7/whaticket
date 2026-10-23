import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueService from "../services/QueueService/CreateQueueService";
import DeleteQueueService from "../services/QueueService/DeleteQueueService";
import ListQueuesService from "../services/QueueService/ListQueuesService";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import UpdateQueueService from "../services/QueueService/UpdateQueueService";
import Queue from "../models/Queue";
import { head } from "lodash";
import fs from "fs";
import path from "path";
import AppError from "../errors/AppError";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const queues = await ListQueuesService({ companyId });

  return res.status(200).json(queues);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    if (!file) {
      throw new AppError("Nenhum arquivo enviado", 400);
    }

    const queue = await Queue.findOne({
      where: { id: queueId, companyId }
    });

    if (!queue) {
      throw new AppError("ERR_NO_QUEUE_FOUND", 404);
    }

    await queue.update({
      mediaPath: file.filename,
      mediaName: file.originalname
    });

    return res.send({ mensagem: "Arquivo Salvo" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  try {
    const queue = await Queue.findOne({
      where: { id: queueId, companyId }
    });

    if (!queue) {
      throw new AppError("ERR_NO_QUEUE_FOUND", 404);
    }

    const rawMediaPath = queue.getDataValue("mediaPath") || queue.mediaPath;
    if (rawMediaPath) {
      const companyBaseDir = path.resolve("public", `company${companyId}`);
      const safeFileName = path.basename(String(rawMediaPath));
      const filePath = path.resolve(companyBaseDir, safeFileName);

      if (
        filePath.startsWith(companyBaseDir + path.sep) &&
        fs.existsSync(filePath)
      ) {
        fs.unlinkSync(filePath);
      }
    }

    queue.mediaPath = null;
    queue.mediaName = null;
    await queue.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    orderQueue,
    integrationId,
    promptId,
    linkToGroup
  } = req.body;
  const { companyId } = req.user;

  const queue = await CreateQueueService({
    name,
    color,
    greetingMessage,
    companyId,
    outOfHoursMessage,
    schedules,
    orderQueue: orderQueue === "" ? null : orderQueue,
    integrationId: integrationId === "" ? null : integrationId,
    promptId: promptId === "" ? null : promptId,
    linkToGroup: linkToGroup || false
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "update",
    queue
  });

  return res.status(200).json(queue);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  const queue = await ShowQueueService(queueId, companyId);

  return res.status(200).json(queue);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;
  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    orderQueue,
    integrationId,
    promptId,
    linkToGroup
  } = req.body;
  const queue = await UpdateQueueService(
    queueId,
    {
      name,
      color,
      greetingMessage,
      outOfHoursMessage,
      schedules,
      orderQueue: orderQueue === "" ? null : orderQueue,
      integrationId: integrationId === "" ? null : integrationId,
      promptId: promptId === "" ? null : promptId,
      linkToGroup: linkToGroup || false
    },
    companyId
  );

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "update",
    queue
  });

  return res.status(201).json(queue);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  await DeleteQueueService(queueId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "delete",
    queueId: +queueId
  });

  return res.status(200).send();
};
