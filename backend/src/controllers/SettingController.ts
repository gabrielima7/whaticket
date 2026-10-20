import { Request, Response } from "express";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import * as Yup from "yup";

import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import { head } from "lodash";
import fs from "fs";
import path from "path";
import User from "../models/User";
import Company from "../models/Company";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import ShowSettingsService from "../services/SettingServices/ShowSettingsService";

const SUPER_ADMIN_COMPANY_ID = Number(process.env.SUPER_ADMIN_COMPANY_ID || 1);

const GLOBAL_SETTINGS = [
  "giphyApiKey",
  "enablePasswordRecovery",
  "passwordRecoveryWhatsAppId",
  "passwordRecoveryMessage",
  "geminiApiToken",
  "geminiModel"
];

const PUBLIC_SETTINGS = [
  "allowSignup",
  "allowregister",
  "viewregister",
  "userCreation",
  "copyright",
  "primaryColor",
  "appLogoLight",
  "appLogoDark",
  "appLogoFavicon",
  "trial",
  "system-default-language",
  "call",
  "sideMenuColor",
  "sideMenuColorDark"
];

const SENSITIVE_SETTINGS = [
  "geminiApiToken",
  "openaikeyaudio",
  "mpAccessToken",
  "gerencianetClientSecret",
  "gerencianetClientId",
  "gerencianetPixKey",
  "gerencianetPixCert",
  "jwtSecret",
  "jwtRefreshSecret",
  "envToken"
];

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const settings = await ListSettingsService({ companyId });

  return res.status(200).json(settings);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { settingKey: key } = req.params;
  const { value } = req.body;
  const { companyId, id: userId } = req.user;

  let targetCompanyId = companyId;
  if (GLOBAL_SETTINGS.includes(key)) {
    const requestUser = await User.findByPk(userId);
    if (!requestUser?.super) {
      throw new AppError("Você não tem permissão para modificar esta configuração!", 403);
    }
    targetCompanyId = SUPER_ADMIN_COMPANY_ID;
  }

  const setting = await UpdateSettingService({
    key,
    value,
    companyId: targetCompanyId
  });

  const io = getIO();
  io.to(`company-${targetCompanyId}-mainchannel`).emit(`company-${targetCompanyId}-settings`, {
    action: "update",
    setting
  });

  return res.status(200).json(setting);
};

export const show = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { settingKey } = req.params;

  // Tenta extrair req.user caso não tenha passado pelo middleware isAuth
  if (!req.user && req.headers.authorization) {
    try {
      const [, token] = req.headers.authorization.split(" ");
      if (token) {
        const decoded = verify(token, authConfig.secret) as any;
        req.user = {
          id: decoded.id,
          profile: decoded.profile,
          companyId: decoded.companyId
        };
      }
    } catch {
      // token inválido ou expirado
    }
  }

  // 1. Requisição pública (sem autenticação)
  if (!req.user) {
    if (PUBLIC_SETTINGS.includes(settingKey)) {
      try {
        const retornoData = await ShowSettingsService({
          settingKey,
          companyId: SUPER_ADMIN_COMPANY_ID
        });
        return res.status(200).json(retornoData);
      } catch {
        return res.status(200).json({ key: settingKey, value: null });
      }
    }

    // Se uma chave não pública for requisitada sem autenticação, retorne status 403 (NUNCA 401!)
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // 2. Requisição autenticada
  const { companyId, id: userId, profile } = req.user;

  // Apenas segredos administrativos (mpAccessToken, gerencianetClientSecret, geminiApiToken)
  // devem ser restritos a administradores — e se negados, retornem status 403 (NUNCA 401!)
  if (SENSITIVE_SETTINGS.includes(settingKey)) {
    const requestUser = await User.findByPk(userId);
    if (!requestUser?.super && profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  // Para usuários autenticados, permite a leitura das configurações normais da empresa
  const requestUser = await User.findByPk(userId);
  let targetCompanyId = requestUser?.super ? SUPER_ADMIN_COMPANY_ID : companyId;
  if (GLOBAL_SETTINGS.includes(settingKey)) {
    targetCompanyId = SUPER_ADMIN_COMPANY_ID;
  }

  let retornoData;
  try {
    retornoData = await ShowSettingsService({
      settingKey,
      companyId: targetCompanyId
    });
  } catch (err) {
    // Se a empresa do tenant ainda não possui a chave personalizada, faz fallback para SUPER_ADMIN_COMPANY_ID
    if (targetCompanyId !== SUPER_ADMIN_COMPANY_ID) {
      try {
        retornoData = await ShowSettingsService({
          settingKey,
          companyId: SUPER_ADMIN_COMPANY_ID
        });
      } catch {
        return res.status(200).json({ key: settingKey, value: null });
      }
    } else {
      return res.status(200).json({ key: settingKey, value: null });
    }
  }

  return res.status(200).json(retornoData);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { body } = req.body;
  const { companyId } = req.user;

  const userId = req.user.id;
  const requestUser = await User.findByPk(userId);

  if (requestUser.super === false) {
    throw new AppError("você nao tem permissão para esta ação!", 403);
  }

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (companyId !== SUPER_ADMIN_COMPANY_ID) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const files = req.files as Express.Multer.File[];
  const file = head(files);
  console.log(file);
  return res.send({ mensagem: "Arquivo Anexado" });
};

export const gerencianetCertUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile, id: userId } = req.user;

  const requestUser = await User.findByPk(userId);

  if (!requestUser?.super) {
    throw new AppError("você nao tem permissão para esta ação!", 403);
  }

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (companyId !== SUPER_ADMIN_COMPANY_ID) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("Nenhum certificado foi enviado.", 400);
  }

  const certKey = path.parse(file.filename).name;

  const setting = await UpdateSettingService({
    key: "gerencianetPixCert",
    value: certKey,
    companyId: SUPER_ADMIN_COMPANY_ID
  });

  return res.status(200).json({
    filename: file.filename,
    setting
  });
};

export const docUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { body } = req.body;
  const { companyId } = req.user;

  const userId = req.user.id;
  const requestUser = await User.findByPk(userId);

  if (requestUser.super === false) {
    throw new AppError("você nao tem permissão para esta ação!", 403);
  }

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (companyId !== SUPER_ADMIN_COMPANY_ID) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const files = req.files as Express.Multer.File[];
  const file = head(files);
  console.log(file);
  return res.send({ mensagem: "Arquivo Anexado" });
};
