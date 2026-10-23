import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { removeWbot, restartWbot } from "../libs/wbot";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import AppError from "../errors/AppError";
import fs from "fs";
import path from "path";

interface WhatsappData {
  name: string;
  queueIds: number[];
  companyId: number;
  greetingMessage?: string;
  greetingMediaPath?: string;
  greetingMediaName?: string;
  greetingMediaSendMode?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  pix?: string;
  pixMessage?: string;
  transferQueueId?: number;
  timeToTransfer?: number;
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
}

interface QueryParams {
  session?: number | string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListWhatsAppsService({ companyId, session });

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    greetingMediaPath,
    greetingMediaName,
    greetingMediaSendMode,
    complationMessage,
    ratingMessage,
    outOfHoursMessage,
    queueIds,
    token,
    pix,
    pixMessage,
    transferQueueId,
    timeToTransfer,
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage
  }: WhatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    greetingMediaPath,
    greetingMediaName,
    greetingMediaSendMode,
    complationMessage,
    ratingMessage,
    outOfHoursMessage,
    queueIds,
    companyId,
    token,
    pix,
    pixMessage,
    transferQueueId,
    timeToTransfer,
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage
  });

  StartWhatsAppSession(whatsapp, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-whatsapp`,
    {
      action: "update",
      whatsapp
    }
  );

  if (oldDefaultWhatsapp) {
    io.to(`company-${companyId}-mainchannel`).emit(
      `company-${companyId}-whatsapp`,
      {
        action: "update",
        whatsapp: oldDefaultWhatsapp
      }
    );
  }

  return res.status(200).json(whatsapp);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { session } = req.query;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId, session);

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-whatsapp`,
    {
      action: "update",
      whatsapp
    }
  );

  if (oldDefaultWhatsapp) {
    io.to(`company-${companyId}-mainchannel`).emit(
      `company-${companyId}-whatsapp`,
      {
        action: "update",
        whatsapp: oldDefaultWhatsapp
      }
    );
  }

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  await ShowWhatsAppService(whatsappId, companyId);

  await DeleteWhatsAppService(whatsappId);
  removeWbot(+whatsappId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-whatsapp`,
    {
      action: "delete",
      whatsappId: +whatsappId
    }
  );

  return res.status(200).json({ message: "Whatsapp deleted." });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await restartWbot(companyId);

  return res.status(200).json({ message: "Whatsapp restart." });
};

export const greetingMediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const file = req.file as Express.Multer.File;
  const { companyId } = req.user;

  try {
    if (!file) {
      throw new AppError("Nenhum arquivo foi enviado");
    }

    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    const folder = path.resolve("public", `company${companyId}`, "greeting");
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const rawExt = path.extname(file.originalname).toLowerCase();
    const rawBase = path.basename(file.originalname, rawExt);
    const safeBase = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const fileName = `${Date.now()}_${safeBase}${rawExt}`;
    const filePath = path.resolve(folder, fileName);

    if (!filePath.startsWith(folder + path.sep)) {
      throw new AppError("Caminho de arquivo inválido", 403);
    }

    fs.copyFileSync(file.path, filePath);
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await whatsapp.update({
      greetingMediaPath: `greeting/${fileName}`,
      greetingMediaName: file.originalname
    });

    return res.send({ mensagem: "Arquivo Salvo" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

export const deleteGreetingMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    if (whatsapp.greetingMediaPath) {
      const companyBaseDir = path.resolve("public", `company${companyId}`);
      const safeRelPath = path
        .normalize(whatsapp.greetingMediaPath)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.resolve(companyBaseDir, safeRelPath);

      if (
        filePath.startsWith(companyBaseDir + path.sep) &&
        fs.existsSync(filePath)
      ) {
        fs.unlinkSync(filePath);
      }
    }

    await whatsapp.update({
      greetingMediaPath: null,
      greetingMediaName: null
    });

    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};
