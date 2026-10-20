"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../errors/AppError"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const tokenAuth = async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError_1.default("Acesso não permitido", 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        throw new AppError_1.default("Acesso não permitido", 401);
    }
    const whatsapp = await Whatsapp_1.default.findOne({ where: { token } });
    if (!whatsapp) {
        throw new AppError_1.default("Acesso não permitido", 401);
    }
    req.params = {
        ...req.params,
        whatsappId: whatsapp.id.toString()
    };
    return next();
};
exports.default = tokenAuth;
