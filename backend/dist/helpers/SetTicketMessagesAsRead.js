"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import cacheLayer from "../libs/cache";
const socket_1 = require("../libs/socket");
const Message_1 = __importDefault(require("../models/Message"));
const logger_1 = require("../utils/logger");
const GetTicketWbot_1 = __importDefault(require("./GetTicketWbot"));
const SetTicketMessagesAsRead = async (ticket) => {
    await ticket.update({ unreadMessages: 0 });
    // 1. Tentar marcar como lido no socket do WhatsApp (Baileys / libzapitu-rf) de forma defensiva
    try {
        const wbot = await (0, GetTicketWbot_1.default)(ticket);
        if (!ticket.contact) {
            await ticket.reload({ include: ["contact"] });
        }
        // ID-032: Usar findOne para obter apenas a última mensagem não lida
        const latestUnread = await Message_1.default.findOne({
            where: {
                ticketId: ticket.id,
                fromMe: false,
                read: false
            },
            order: [["createdAt", "DESC"]]
        });
        if (latestUnread && wbot) {
            let messageKey;
            // ID-032: Parse seguro do dataJson sem JSON.stringify redundante
            if (latestUnread.dataJson) {
                try {
                    const parsed = typeof latestUnread.dataJson === "string"
                        ? JSON.parse(latestUnread.dataJson)
                        : latestUnread.dataJson;
                    messageKey = parsed?.key;
                }
                catch (e) {
                    logger_1.logger.warn(`SetTicketMessagesAsRead: erro ao parsear dataJson da msg ${latestUnread.id}`);
                }
            }
            const remoteJid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
            // ID-032: Garantir que a key esteja montada para que o Baileys marque como lida
            const key = messageKey || {
                remoteJid,
                id: latestUnread.id,
                fromMe: false
            };
            const lastMessages = {
                key
            };
            if (typeof wbot.readMessages === "function") {
                await wbot.readMessages([key]);
            }
            else if (typeof wbot.chatModify === "function") {
                await wbot.chatModify({ markRead: true, lastMessages: [lastMessages] }, key.remoteJid || remoteJid);
            }
        }
    }
    catch (err) {
        logger_1.logger.warn(`SetTicketMessagesAsRead: Could not mark messages as read in whatsapp socket. Maybe session disconnected? Err: ${err}`);
    }
    // 2. Atualizar no banco de dados independentemente de oscilações ou erros no socket
    try {
        await Message_1.default.update({ read: true }, {
            where: {
                ticketId: ticket.id,
                read: false
            }
        });
    }
    catch (err) {
        logger_1.logger.error(`SetTicketMessagesAsRead: Error updating messages in database: ${err}`);
    }
    const io = (0, socket_1.getIO)();
    io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
        action: "updateUnread",
        ticketId: ticket.id
    });
};
exports.default = SetTicketMessagesAsRead;
