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
exports.ClosedAllOpenTickets = void 0;
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const Contact_1 = __importDefault(require("../../models/Contact"));
const socket_1 = require("../../libs/socket");
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const SendWhatsAppMessage_1 = __importDefault(require("./SendWhatsAppMessage"));
const moment_1 = __importDefault(require("moment"));
const wbotMessageListener_1 = require("./wbotMessageListener");
const TicketTraking_1 = __importDefault(require("../../models/TicketTraking"));
const logger_1 = require("../../utils/logger");
const Sentry = __importStar(require("@sentry/node"));
const ClosedAllOpenTickets = async (companyId) => {
    const closeTicket = async (ticket, body) => {
        await ticket.update({
            status: "closed",
            lastMessage: body,
            unreadMessages: 0,
            amountUseBotQueues: 0
        });
    };
    const io = (0, socket_1.getIO)();
    try {
        // ID-039 & ID-042: Eager load contact e whatsapp em 1 query única, eliminando N+1
        const tickets = await Ticket_1.default.findAll({
            where: { status: "open", companyId },
            include: [
                {
                    model: Contact_1.default,
                    as: "contact"
                },
                {
                    model: Whatsapp_1.default,
                    as: "whatsapp"
                }
            ],
            order: [["updatedAt", "DESC"]]
        });
        for (const ticket of tickets) {
            const whatsapp = ticket.whatsapp;
            if (!whatsapp)
                continue;
            const { expiresInactiveMessage, expiresTicket } = whatsapp;
            if (Number(expiresTicket) > 0) {
                if (ticket.status === "open" && !ticket.isGroup) {
                    const dataLimite = new Date();
                    dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));
                    const dataUltimaInteracaoChamado = new Date(ticket.updatedAt);
                    if (dataUltimaInteracaoChamado < dataLimite && ticket.fromMe) {
                        const bodyExpiresMessageInactive = (0, Mustache_1.default)(`\u200e ${expiresInactiveMessage}`, ticket.contact);
                        await closeTicket(ticket, bodyExpiresMessageInactive);
                        if (expiresInactiveMessage && expiresInactiveMessage.trim() !== "") {
                            const sentMessage = await (0, SendWhatsAppMessage_1.default)({
                                body: bodyExpiresMessageInactive,
                                ticket
                            });
                            await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticket, ticket.contact);
                        }
                        const ticketTraking = await TicketTraking_1.default.findOne({
                            where: {
                                ticketId: ticket.id,
                                finishedAt: null
                            }
                        });
                        if (ticketTraking) {
                            await ticketTraking.update({
                                finishedAt: (0, moment_1.default)().toDate(),
                                closedAt: (0, moment_1.default)().toDate(),
                                whatsappId: ticket.whatsappId,
                                userId: ticket.userId
                            });
                        }
                        // ID-004: Isolar sala de socket por empresa
                        io.to(`company-${companyId}-open`).emit(`company-${companyId}-ticket`, {
                            action: "delete",
                            ticketId: ticket.id
                        });
                    }
                }
            }
        }
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.error(`ClosedAllOpenTickets error: ${e?.message}`, e);
    }
};
exports.ClosedAllOpenTickets = ClosedAllOpenTickets;
