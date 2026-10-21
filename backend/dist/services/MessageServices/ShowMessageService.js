"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetWhatsAppFromMessage = void 0;
const Message_1 = __importDefault(require("../../models/Message"));
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const ShowMessageService = async (messageId, companyId) => {
    const where = { id: messageId };
    if (companyId) {
        where.companyId = companyId;
    }
    const message = await Message_1.default.findOne({
        where,
        include: [
            "contact",
            {
                model: Ticket_1.default,
                as: "ticket"
            }
        ]
    });
    return message || undefined;
};
const GetWhatsAppFromMessage = async (message) => {
    const ticketId = message.ticketId;
    const ticket = await Ticket_1.default.findByPk(ticketId);
    if (!ticket) {
        return null;
    }
    return ticket.whatsappId;
};
exports.GetWhatsAppFromMessage = GetWhatsAppFromMessage;
exports.default = ShowMessageService;
