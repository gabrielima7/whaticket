"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const isAuth_1 = __importDefault(require("../middleware/isAuth"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const GeminiController = __importStar(require("../controllers/GeminiController"));
const geminiRoutes = (0, express_1.Router)();
// Rate limiting específico para Gemini: máximo 10 requisições por minuto por usuário
const geminiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Muitas requisições ao Gemini. Aguarde um minuto antes de tentar novamente.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Pular rate limit para localhost (desenvolvimento)
        return req.ip === '127.0.0.1' || req.ip === '::1';
    },
    keyGenerator: (req) => {
        // Usar companyId + userId para rate limiting por empresa/usuário
        const companyId = req.user?.companyId || req.ip;
        const userId = req.user?.id || 'anonymous';
        return `gemini:${companyId}:${userId}`;
    }
});
geminiRoutes.post("/gemini/suggestions", isAuth_1.default, geminiRateLimiter, GeminiController.generateSuggestions);
exports.default = geminiRoutes;
