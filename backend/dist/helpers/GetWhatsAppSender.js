"use strict";
/**
 * Retorna o "sender" de WhatsApp para um ticket ou whatsappId.
 * Usa o socket libzapitu (getWbot) para envio de mensagens.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppSenderByWhatsappId = exports.getWhatsAppSenderForTicket = void 0;
const wbot_1 = require("../libs/wbot");
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
/** Retorna sender para um ticket (usado por GetTicketWbot). */
async function getWhatsAppSenderForTicket(ticket) {
    const whatsappId = ticket.whatsappId;
    if (!whatsappId) {
        throw new Error("ERR_WAPP_NOT_FOUND");
    }
    const whatsapp = await Whatsapp_1.default.findByPk(whatsappId);
    if (!whatsapp) {
        throw new Error("ERR_WAPP_NOT_FOUND");
    }
    const wbot = (0, wbot_1.getWbot)(whatsappId);
    return {
        id: wbot.id,
        sendMessage: (jid, content, options) => wbot.sendMessage(jid, content, options),
        logout: wbot.logout ? () => Promise.resolve(wbot.logout?.()).then(() => { }) : undefined
    };
}
exports.getWhatsAppSenderForTicket = getWhatsAppSenderForTicket;
/** Retorna sender por whatsappId (usado por filas, campanhas, agendamentos). */
async function getWhatsAppSenderByWhatsappId(whatsappId) {
    const whatsapp = await Whatsapp_1.default.findByPk(whatsappId);
    if (!whatsapp) {
        throw new Error("ERR_WAPP_NOT_FOUND");
    }
    const wbot = (0, wbot_1.getWbot)(whatsappId);
    return {
        id: wbot.id,
        sendMessage: (jid, content, options) => wbot.sendMessage(jid, content, options),
        logout: wbot.logout ? () => Promise.resolve(wbot.logout?.()).then(() => { }) : undefined
    };
}
exports.getWhatsAppSenderByWhatsappId = getWhatsAppSenderByWhatsappId;
