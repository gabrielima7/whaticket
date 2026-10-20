import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";
import envTokenAuth from "./envTokenAuth";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

const allowSuperOrEnvToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user) {
    const user = await User.findByPk(req.user.id);
    if (user && (user.super || user.profile === "admin")) {
      return next();
    }
  }

  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const [, token] = authHeader.split(" ");
      if (token) {
        const decoded = verify(token, authConfig.secret) as TokenPayload;
        if (decoded && decoded.id) {
          const user = await User.findByPk(decoded.id);
          if (user && (user.super || user.profile === "admin")) {
            req.user = {
              id: String(user.id),
              profile: user.profile,
              companyId: user.companyId
            };
            return next();
          }
        }
      }
    } catch {
      // Token inválido ou expirado: prossegue para validação via envTokenAuth
    }
  }

  // Requisição não autenticada como SuperAdmin/Admin: exige validação via ENV_TOKEN
  return envTokenAuth(req, res, next);
};

export default allowSuperOrEnvToken;
