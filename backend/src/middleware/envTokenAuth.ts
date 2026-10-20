import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import AppError from "../errors/AppError";

type TokenPayload = {
  token?: string;
};

const safeCompare = (providedToken: string, expectedToken: string): boolean => {
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const envTokenAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const envToken = process.env.ENV_TOKEN;

  if (!envToken || typeof envToken !== "string" || envToken.trim().length === 0) {
    throw new AppError("Registro desabilitado: ENV_TOKEN não configurado no servidor", 403);
  }

  const { token: bodyToken } = (req.body || {}) as TokenPayload;
  const { token: queryToken } = (req.query || {}) as TokenPayload;
  const headerToken = req.headers["x-env-token"] as string | undefined;

  const candidateToken = bodyToken || queryToken || headerToken;

  if (candidateToken && typeof candidateToken === "string" && safeCompare(candidateToken, envToken)) {
    return next();
  }

  throw new AppError("Token inválido", 403);
};

export default envTokenAuth;
