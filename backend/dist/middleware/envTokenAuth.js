"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const safeCompare = (providedToken, expectedToken) => {
    const providedBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(expectedToken);
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(providedBuffer, expectedBuffer);
};
const envTokenAuth = (req, res, next) => {
    const envToken = process.env.ENV_TOKEN;
    if (!envToken || typeof envToken !== "string" || envToken.trim().length === 0) {
        throw new AppError_1.default("Registro desabilitado: ENV_TOKEN não configurado no servidor", 403);
    }
    const { token: bodyToken } = (req.body || {});
    const { token: queryToken } = (req.query || {});
    const headerToken = req.headers["x-env-token"];
    const candidateToken = bodyToken || queryToken || headerToken;
    if (candidateToken && typeof candidateToken === "string" && safeCompare(candidateToken, envToken)) {
        return next();
    }
    throw new AppError_1.default("Token inválido", 403);
};
exports.default = envTokenAuth;
