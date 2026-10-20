"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GetDefaultWhatsApp_1 = __importDefault(require("./GetDefaultWhatsApp"));
const GetWhatsAppSender_1 = require("./GetWhatsAppSender");
const GetTicketWbot = async (ticket) => {
    if (!ticket.whatsappId) {
        const defaultWhatsapp = await (0, GetDefaultWhatsApp_1.default)(ticket.companyId, ticket.userId);
        await ticket.$set("whatsapp", defaultWhatsapp);
    }
    return (0, GetWhatsAppSender_1.getWhatsAppSenderForTicket)(ticket);
};
exports.default = GetTicketWbot;
