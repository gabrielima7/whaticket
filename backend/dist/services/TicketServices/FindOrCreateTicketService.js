"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const date_fns_1 = require("date-fns");
const sequelize_1 = require("sequelize");
const async_mutex_1 = require("async-mutex");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const Queue_1 = __importDefault(require("../../models/Queue"));
const ShowTicketService_1 = __importDefault(require("./ShowTicketService"));
const FindOrCreateATicketTrakingService_1 = __importDefault(require("./FindOrCreateATicketTrakingService"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const database_1 = __importDefault(require("../../database"));
const ticketMutexes = new Map();
const getTicketMutex = (key) => {
    let mutex = ticketMutexes.get(key);
    if (!mutex) {
        mutex = new async_mutex_1.Mutex();
        ticketMutexes.set(key, mutex);
    }
    return mutex;
};
const FindOrCreateTicketService = async (contact, whatsappId, unreadMessages, companyId, groupContact, openTicketSchedule) => {
    const contactKey = `${companyId}:${groupContact ? groupContact.id : contact.id}`;
    const mutex = getTicketMutex(contactKey);
    const ticketId = await mutex.runExclusive(async () => {
        return await database_1.default.transaction(async (transaction) => {
            let ticket = await Ticket_1.default.findOne({
                where: {
                    status: {
                        [sequelize_1.Op.or]: ["open", "pending", "closed"]
                    },
                    contactId: groupContact ? groupContact.id : contact.id,
                    companyId,
                    whatsappId
                },
                order: [["id", "DESC"]],
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (ticket) {
                if (openTicketSchedule) {
                    await ticket.update({ status: "open", unreadMessages }, { transaction });
                }
                await ticket.update({ unreadMessages, whatsappId }, { transaction });
            }
            if (ticket?.status === "closed") {
                await ticket.update({ queueId: null, userId: null }, { transaction });
            }
            if (!ticket && groupContact) {
                ticket = await Ticket_1.default.findOne({
                    where: {
                        contactId: groupContact.id,
                        companyId
                    },
                    order: [["updatedAt", "DESC"]],
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });
                if (ticket) {
                    await ticket.update({
                        status: "pending",
                        userId: null,
                        unreadMessages,
                        queueId: null,
                        companyId,
                        whatsappId
                    }, { transaction });
                    await (0, FindOrCreateATicketTrakingService_1.default)({
                        ticketId: ticket.id,
                        companyId,
                        whatsappId,
                        userId: ticket.userId,
                        transaction
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
                        companyId
                    },
                    order: [["updatedAt", "DESC"]],
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });
                if (ticket) {
                    await ticket.update({
                        status: "pending",
                        userId: null,
                        unreadMessages,
                        queueId: null,
                        companyId,
                        whatsappId
                    }, { transaction });
                    await (0, FindOrCreateATicketTrakingService_1.default)({
                        ticketId: ticket.id,
                        companyId,
                        whatsappId,
                        userId: ticket.userId,
                        transaction
                    });
                }
            }
            const whatsapp = await Whatsapp_1.default.findOne({
                where: { id: whatsappId, companyId },
                transaction
            });
            if (!ticket) {
                let queueIdToLink = null;
                if (groupContact) {
                    const queueWithLinkToGroup = await Queue_1.default.findOne({
                        where: {
                            companyId,
                            linkToGroup: true
                        },
                        order: [["id", "DESC"]],
                        transaction
                    });
                    if (queueWithLinkToGroup) {
                        queueIdToLink = queueWithLinkToGroup.id;
                    }
                }
                ticket = await Ticket_1.default.create({
                    contactId: groupContact ? groupContact.id : contact.id,
                    status: "pending",
                    isGroup: !!groupContact,
                    unreadMessages,
                    whatsappId,
                    companyId,
                    queueId: queueIdToLink
                }, { transaction });
                await (0, FindOrCreateATicketTrakingService_1.default)({
                    ticketId: ticket.id,
                    companyId,
                    whatsappId,
                    userId: ticket.userId,
                    transaction
                });
            }
            else if (groupContact && ticket.isGroup && !ticket.queueId) {
                const queueWithLinkToGroup = await Queue_1.default.findOne({
                    where: {
                        companyId,
                        linkToGroup: true
                    },
                    order: [["id", "DESC"]],
                    transaction
                });
                if (queueWithLinkToGroup) {
                    await ticket.update({ queueId: queueWithLinkToGroup.id }, { transaction });
                }
            }
            return ticket.id;
        });
    });
    // Mutex memory cleanup
    if (!mutex.isLocked()) {
        ticketMutexes.delete(contactKey);
    }
    const finalTicket = await (0, ShowTicketService_1.default)(ticketId, companyId);
    return finalTicket;
};
exports.default = FindOrCreateTicketService;
