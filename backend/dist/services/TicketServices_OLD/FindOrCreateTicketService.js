"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const date_fns_1 = require("date-fns");
const sequelize_1 = require("sequelize");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const ShowTicketService_1 = __importDefault(require("./ShowTicketService"));
const FindOrCreateATicketTrakingService_1 = __importDefault(require("./FindOrCreateATicketTrakingService"));
const database_1 = __importDefault(require("../../database"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const FindOrCreateTicketService = async (contact, whatsappId, unreadMessages, companyId, groupContact) => {
    const result = await database_1.default.transaction(async () => {
        let ticket = await Ticket_1.default.findOne({
            where: {
                status: {
                    [sequelize_1.Op.or]: ["open", "pending"]
                },
                contactId: groupContact ? groupContact.id : contact.id,
                whatsappId
            },
            order: [["id", "DESC"]]
        });
        if (ticket) {
            await ticket.update({ unreadMessages });
        }
        if (!ticket && groupContact) {
            ticket = await Ticket_1.default.findOne({
                where: {
                    contactId: groupContact.id,
                    whatsappId
                },
                order: [["updatedAt", "DESC"]]
            });
            if (ticket) {
                await ticket.update({
                    status: "pending",
                    userId: null,
                    unreadMessages,
                    companyId
                });
                await (0, FindOrCreateATicketTrakingService_1.default)({
                    ticketId: ticket.id,
                    companyId,
                    whatsappId: ticket.whatsappId,
                    userId: ticket.userId
                });
            }
        }
        if (!ticket && !groupContact) {
            ticket = await Ticket_1.default.findOne({
                where: {
                    updatedAt: {
                        [sequelize_1.Op.between]: [+(0, date_fns_1.subHours)(new Date(), 2), +new Date()]
                    },
                    contactId: contact.id,
                    whatsappId
                },
                order: [["updatedAt", "DESC"]]
            });
            if (ticket) {
                await ticket.update({
                    status: "pending",
                    userId: null,
                    unreadMessages,
                    companyId
                });
                await (0, FindOrCreateATicketTrakingService_1.default)({
                    ticketId: ticket.id,
                    companyId,
                    whatsappId: ticket.whatsappId,
                    userId: ticket.userId
                });
            }
        }
        let queueId = null;
        if (groupContact) {
            const whatsapp = await Whatsapp_1.default.findByPk(whatsappId, {
                include: ["queues"]
            });
            if (whatsapp?.queues.length === 1) {
                queueId = whatsapp.queues[0].id;
            }
        }
        if (!ticket) {
            ticket = await Ticket_1.default.create({
                contactId: groupContact ? groupContact.id : contact.id,
                status: "pending",
                isGroup: !!groupContact,
                unreadMessages,
                whatsappId,
                queueId,
                companyId
            });
            await (0, FindOrCreateATicketTrakingService_1.default)({
                ticketId: ticket.id,
                companyId,
                whatsappId,
                userId: ticket.userId
            });
        }
        ticket = await (0, ShowTicketService_1.default)(ticket.id, companyId);
        return ticket;
    });
    return result;
};
exports.default = FindOrCreateTicketService;
