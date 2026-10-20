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
exports.StartWhatsAppSession = void 0;
const wbot_1 = require("../../libs/wbot");
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const wbotMessageListener_1 = require("./wbotMessageListener");
const socket_1 = require("../../libs/socket");
const wbotMonitor_1 = __importDefault(require("./wbotMonitor"));
const logger_1 = require("../../utils/logger");
const Sentry = __importStar(require("@sentry/node"));
const StartWhatsAppSession = async (whatsapp, companyId) => {
    const whatsappUpdated = await Whatsapp_1.default.findOne({
        where: { id: whatsapp.id }
    });
    if (!whatsappUpdated) {
        logger_1.logger.error(`WhatsApp ${whatsapp.id} não encontrado`);
        return;
    }
    if (whatsappUpdated.status === "CONNECTED") {
        try {
            const wbot = (0, wbot_1.getWbot)(whatsapp.id);
            logger_1.logger.info(`WhatsApp ${whatsapp.name} (ID: ${whatsapp.id}) já está CONNECTED e tem sessão ativa.`);
            const io = (0, socket_1.getIO)();
            io.emit(`company-${companyId}-whatsappSession`, {
                action: "update",
                session: whatsappUpdated
            });
            return;
        }
        catch (err) {
            if (err.message === "ERR_WAPP_NOT_INITIALIZED") {
                logger_1.logger.warn(`WhatsApp ${whatsapp.name} (ID: ${whatsapp.id}) CONNECTED mas sem sessão na memória. Reinicializando.`);
                await whatsappUpdated.update({ status: "DISCONNECTED" });
            }
            else {
                logger_1.logger.error(`Erro ao verificar sessão do WhatsApp ${whatsapp.id}:`, err);
                return;
            }
        }
    }
    await whatsappUpdated.update({ status: "OPENING" });
    const io = (0, socket_1.getIO)();
    io.emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: whatsappUpdated
    });
    try {
        const wbot = await (0, wbot_1.initWASocket)(whatsappUpdated);
        (0, wbotMessageListener_1.wbotMessageListener)(wbot, companyId);
        await (0, wbotMonitor_1.default)(wbot, whatsappUpdated, companyId);
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(err);
    }
};
exports.StartWhatsAppSession = StartWhatsAppSession;
