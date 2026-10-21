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
const moment_1 = __importDefault(require("moment"));
const Sentry = __importStar(require("@sentry/node"));
const CheckContactOpenTickets_1 = __importDefault(require("../../helpers/CheckContactOpenTickets"));
const SetTicketMessagesAsRead_1 = __importDefault(require("../../helpers/SetTicketMessagesAsRead"));
const socket_1 = require("../../libs/socket");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const Queue_1 = __importDefault(require("../../models/Queue"));
const ShowTicketService_1 = __importDefault(require("./ShowTicketService"));
const ShowWhatsAppService_1 = __importDefault(require("../WhatsappService/ShowWhatsAppService"));
const SendWhatsAppMessage_1 = __importDefault(require("../WbotServices/SendWhatsAppMessage"));
const FindOrCreateATicketTrakingService_1 = __importDefault(require("./FindOrCreateATicketTrakingService"));
const GetTicketWbot_1 = __importDefault(require("../../helpers/GetTicketWbot"));
const wbotMessageListener_1 = require("../WbotServices/wbotMessageListener");
const ListSettingsServiceOne_1 = __importDefault(require("../SettingServices/ListSettingsServiceOne"));
const ShowUserService_1 = __importDefault(require("../UserServices/ShowUserService"));
const lodash_1 = require("lodash");
const Contact_1 = __importDefault(require("../../models/Contact"));
const User_1 = __importDefault(require("../../models/User"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const global_1 = require("../../utils/global");
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const TicketUser_1 = __importDefault(require("../../models/TicketUser"));
const database_1 = __importDefault(require("../../database"));
const UpdateTicketService = async ({ ticketData, ticketId, companyId }) => {
    try {
        let { status } = ticketData;
        let { queueId, userId, userIds, ticketUsers, whatsappId, lastMessage = null } = ticketData;
        let chatbot = ticketData.chatbot || false;
        let queueOptionId = ticketData.queueOptionId || null;
        let promptId = ticketData.promptId || null;
        let useIntegration = ticketData.useIntegration || false;
        let integrationId = ticketData.integrationId || null;
        const io = (0, socket_1.getIO)();
        let oldStatus = "";
        let oldUserId = undefined;
        let oldQueueId = undefined;
        let hasTicketUsersChanged = false;
        let isEarlyRating = false;
        let ratingMessageToSend = null;
        let shouldSendCompletion = false;
        let completionMessageToSend = null;
        // ID-028: Transação ACID com row-level pessimistic locking (FOR UPDATE)
        await database_1.default.transaction(async (transaction) => {
            // Isolar o lock pessimista sem include de tabelas associadas para evitar erro 0A000 no PostgreSQL
            const lockedTicket = await Ticket_1.default.findOne({
                where: { id: ticketId, companyId },
                lock: transaction.LOCK.UPDATE,
                transaction
            });
            if (!lockedTicket) {
                throw new AppError_1.default("ERR_NO_TICKET_FOUND", 404);
            }
            oldStatus = lockedTicket.status;
            oldUserId = lockedTicket.userId;
            oldQueueId = lockedTicket.queueId;
            if ((0, lodash_1.isNil)(whatsappId)) {
                whatsappId = lockedTicket.whatsappId?.toString();
            }
            // Concurrency check: se outro operador já abriu/aceitou o ticket
            if (status === "open" &&
                userId &&
                oldStatus === "open" &&
                oldUserId &&
                oldUserId !== userId) {
                const assignedUser = await User_1.default.findByPk(oldUserId, {
                    attributes: ["id", "name"]
                });
                throw new AppError_1.default(`TICKET_ALREADY_OPEN|${assignedUser?.name || "Atendente"}|${oldUserId}`, 409);
            }
            const ticketTraking = await (0, FindOrCreateATicketTrakingService_1.default)({
                ticketId,
                companyId,
                whatsappId: lockedTicket.whatsappId,
                transaction
            });
            if (oldStatus === "closed" || Number(whatsappId) !== lockedTicket.whatsappId) {
                await (0, CheckContactOpenTickets_1.default)(lockedTicket.contactId, whatsappId, companyId);
                chatbot = null;
                queueOptionId = null;
            }
            if (status === "closed") {
                let queueLinkToGroup = false;
                if (lockedTicket.queueId) {
                    const queue = await Queue_1.default.findByPk(lockedTicket.queueId, { transaction });
                    queueLinkToGroup = queue?.linkToGroup || false;
                }
                const shouldDisableAutomations = lockedTicket.isGroup && queueLinkToGroup;
                if (!shouldDisableAutomations) {
                    const { complationMessage, ratingMessage } = lockedTicket.whatsappId
                        ? await (0, ShowWhatsAppService_1.default)(lockedTicket.whatsappId, companyId)
                        : { complationMessage: null, ratingMessage: null };
                    const settingEvaluation = await (0, ListSettingsServiceOne_1.default)({
                        companyId,
                        key: "userRating"
                    });
                    const contact = await Contact_1.default.findByPk(lockedTicket.contactId, {
                        attributes: ["id", "isGroup", "disableBot"],
                        transaction
                    });
                    if (lockedTicket.status !== "pending" &&
                        !lockedTicket.isGroup &&
                        !contact?.isGroup &&
                        !contact?.disableBot &&
                        settingEvaluation?.value === "enabled") {
                        if (ticketTraking.ratingAt == null && ticketTraking.userId !== null) {
                            await ticketTraking.update({ ratingAt: (0, moment_1.default)().toDate() }, { transaction });
                            isEarlyRating = true;
                            ratingMessageToSend = ratingMessage;
                            return;
                        }
                        ticketTraking.ratingAt = (0, moment_1.default)().toDate();
                        ticketTraking.rated = false;
                    }
                    else {
                        ticketTraking.finishedAt = (0, moment_1.default)().toDate();
                        if (!lockedTicket.isGroup &&
                            !contact?.isGroup &&
                            !contact?.disableBot &&
                            !(0, lodash_1.isNil)(complationMessage) &&
                            complationMessage !== "") {
                            shouldSendCompletion = true;
                            completionMessageToSend = complationMessage;
                        }
                    }
                }
                else {
                    ticketTraking.finishedAt = (0, moment_1.default)().toDate();
                }
            }
            await lockedTicket.update({
                promptId: null,
                integrationId: null,
                useIntegration: false,
                typebotStatus: false,
                typebotSessionId: null
            }, { transaction });
            if (queueId !== undefined && queueId !== null) {
                ticketTraking.queuedAt = (0, moment_1.default)().toDate();
            }
            // Gerenciar ticketUsers
            if (ticketUsers !== undefined && Array.isArray(ticketUsers)) {
                const currentTicketUsers = await TicketUser_1.default.findAll({
                    where: { ticketId: lockedTicket.id },
                    transaction
                });
                const currentUserIds = currentTicketUsers.map(tu => tu.userId).sort();
                const newUserIds = ticketUsers.map(tu => tu.userId).sort();
                hasTicketUsersChanged =
                    JSON.stringify(currentUserIds) !== JSON.stringify(newUserIds);
                await TicketUser_1.default.destroy({
                    where: { ticketId: lockedTicket.id },
                    transaction
                });
                if (ticketUsers.length > 0) {
                    await TicketUser_1.default.bulkCreate(ticketUsers.map(tu => ({
                        ticketId: lockedTicket.id,
                        userId: tu.userId,
                        queueId: tu.queueId || null
                    })), { transaction });
                    userId = ticketUsers[0].userId;
                    if (lockedTicket.isGroup && ticketUsers[0].queueId) {
                        queueId = ticketUsers[0].queueId;
                    }
                }
                else {
                    userId = null;
                }
            }
            else if (userIds !== undefined && Array.isArray(userIds)) {
                await TicketUser_1.default.destroy({
                    where: { ticketId: lockedTicket.id },
                    transaction
                });
                if (userIds.length > 0) {
                    await TicketUser_1.default.bulkCreate(userIds.map(uId => ({
                        ticketId: lockedTicket.id,
                        userId: uId,
                        queueId: null
                    })), { transaction });
                    userId = userIds[0];
                }
                else {
                    userId = null;
                }
            }
            await lockedTicket.update({
                status,
                queueId,
                userId,
                whatsappId,
                chatbot,
                queueOptionId,
                lastMessage: lastMessage !== null ? lastMessage : lockedTicket.lastMessage
            }, { transaction });
            if (status === "pending") {
                await ticketTraking.update({
                    whatsappId,
                    queuedAt: (0, moment_1.default)().toDate(),
                    startedAt: null,
                    userId: null
                }, { transaction });
            }
            if (status === "open") {
                await ticketTraking.update({
                    startedAt: (0, moment_1.default)().toDate(),
                    ratingAt: null,
                    rated: false,
                    whatsappId,
                    userId: lockedTicket.userId
                }, { transaction });
            }
            await ticketTraking.save({ transaction });
        });
        // Se entrou em fluxo de avaliação de satisfação (interrompe o fechamento regular)
        if (isEarlyRating) {
            const ticket = await (0, ShowTicketService_1.default)(ticketId, companyId);
            const bodyRatingMessage = `${ratingMessageToSend ? ratingMessageToSend + "\n\n" : ""}Digite de 1 a 5 para qualificar nosso atendimento:\n\n*1* - 😞 _Péssimo_\n*2* - 😕 _Ruim_\n*3* - 😐 _Neutro_\n*4* - 🙂 _Bom_\n*5* - 😊 _Ótimo_`;
            await (0, SendWhatsAppMessage_1.default)({ body: bodyRatingMessage, ticket });
            io.to(`company-${ticket.companyId}-open`)
                .to(`queue-${ticket.queueId}-open`)
                .to(ticketId.toString())
                .emit(`company-${ticket.companyId}-ticket`, {
                action: "delete",
                ticketId: ticket.id
            });
            return { ticket, oldStatus, oldUserId };
        }
        // Carregar ticket atualizado com todas as associações após o commit da transação
        const ticketWithUsers = await (0, ShowTicketService_1.default)(ticketId, companyId);
        await (0, SetTicketMessagesAsRead_1.default)(ticketWithUsers);
        // Enviar mensagem de finalização se aplicável
        if (shouldSendCompletion && completionMessageToSend) {
            const body = `\u200e${completionMessageToSend}`;
            const sentMessage = await (0, SendWhatsAppMessage_1.default)({ body, ticket: ticketWithUsers });
            await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticketWithUsers, ticketWithUsers.contact);
        }
        // Notificações de transferência de fila ou atendente
        const settingsTransfTicket = await (0, ListSettingsServiceOne_1.default)({
            companyId,
            key: "sendMsgTransfTicket"
        });
        const settingsTransfTicketMessage = await (0, ListSettingsServiceOne_1.default)({
            companyId,
            key: "sendMsgTransfTicketMessage"
        });
        const transferTemplateDefault = "{{ms}} {{name}}, seu atendimento foi transferido. Departamento: {{queue}}. Atendente: {{agent}}.";
        const transferTemplate = settingsTransfTicketMessage?.value?.trim() || transferTemplateDefault;
        const hasQueueTransfer = !(0, lodash_1.isNil)(oldQueueId) && !(0, lodash_1.isNil)(queueId) && oldQueueId !== queueId;
        const hasAgentTransfer = !(0, lodash_1.isNil)(oldUserId) && !(0, lodash_1.isNil)(userId) && oldUserId !== userId;
        if (settingsTransfTicket?.value === "enabled" &&
            transferTemplate &&
            (hasQueueTransfer || hasAgentTransfer) &&
            !ticketWithUsers.isGroup &&
            !ticketWithUsers.contact.isGroup) {
            const queue = !(0, lodash_1.isNil)(queueId) ? await Queue_1.default.findByPk(queueId) : null;
            const oldQueue = !(0, lodash_1.isNil)(oldQueueId) ? await Queue_1.default.findByPk(oldQueueId) : null;
            const newAgent = !(0, lodash_1.isNil)(userId) ? await (0, ShowUserService_1.default)(userId) : null;
            const previousAgent = !(0, lodash_1.isNil)(oldUserId) ? await (0, ShowUserService_1.default)(oldUserId) : null;
            const messageBody = (0, Mustache_1.default)(transferTemplate, ticketWithUsers.contact, {
                queue: queue?.name || "",
                agent: newAgent?.name || "",
                previousAgent: previousAgent?.name || "",
                previousQueue: oldQueue?.name || ""
            });
            if (messageBody.trim()) {
                const wbot = await (0, GetTicketWbot_1.default)(ticketWithUsers);
                const queueChangedMessage = await wbot.sendMessage((0, global_1.buildContactAddress)(ticketWithUsers.contact, ticketWithUsers.isGroup), {
                    text: messageBody
                });
                await (0, wbotMessageListener_1.verifyMessage)(queueChangedMessage, ticketWithUsers, ticketWithUsers.contact);
            }
        }
        // Mensagem de saudação ao aceitar o ticket
        const settingsGreetingAccepted = await (0, ListSettingsServiceOne_1.default)({
            companyId,
            key: "sendGreetingAccepted"
        });
        const settingsGreetingAcceptedMessage = await (0, ListSettingsServiceOne_1.default)({
            companyId,
            key: "sendGreetingAcceptedMessage"
        });
        const greetingTemplateDefault = "{{ms}} {{name}}, meu nome é {{agent}} e vou prosseguir com seu atendimento!";
        const greetingTemplate = settingsGreetingAcceptedMessage?.value?.trim() || greetingTemplateDefault;
        if (status === "open") {
            if (settingsGreetingAccepted?.value === "enabled" &&
                greetingTemplate &&
                !ticketWithUsers.isGroup &&
                !ticketWithUsers.contact.isGroup &&
                ticketWithUsers.contact.disableBot !== true &&
                oldStatus !== "open") {
                const queue = ticketWithUsers.queueId
                    ? await Queue_1.default.findByPk(ticketWithUsers.queueId)
                    : null;
                const newAgent = ticketWithUsers.userId
                    ? await (0, ShowUserService_1.default)(ticketWithUsers.userId)
                    : null;
                const greetingBody = (0, Mustache_1.default)(greetingTemplate, ticketWithUsers.contact, {
                    queue: queue?.name || "",
                    agent: newAgent?.name || ""
                });
                if (greetingBody.trim()) {
                    const wbot = await (0, GetTicketWbot_1.default)(ticketWithUsers);
                    const sentMessage = await wbot.sendMessage((0, global_1.buildContactAddress)(ticketWithUsers.contact, ticketWithUsers.isGroup), {
                        text: greetingBody
                    });
                    await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticketWithUsers, ticketWithUsers.contact);
                }
            }
        }
        // Emissões via WebSocket
        if (ticketWithUsers.status !== oldStatus ||
            ticketWithUsers.user?.id !== oldUserId ||
            hasTicketUsersChanged) {
            io.to(`company-${companyId}-${oldStatus}`)
                .to(`queue-${ticketWithUsers.queueId}-${oldStatus}`)
                .to(`user-${oldUserId}`)
                .emit(`company-${companyId}-ticket`, {
                action: "delete",
                ticketId: ticketWithUsers.id
            });
        }
        const userIdsToNotify = [ticketWithUsers?.userId, oldUserId].filter(Boolean);
        if (ticketWithUsers.ticketUsers && ticketWithUsers.ticketUsers.length > 0) {
            ticketWithUsers.ticketUsers.forEach((tu) => {
                if (tu.user && tu.user.id && !userIdsToNotify.includes(tu.user.id)) {
                    userIdsToNotify.push(tu.user.id);
                }
            });
        }
        io.to(`company-${companyId}-${ticketWithUsers.status}`)
            .to(`company-${companyId}-notification`)
            .to(`queue-${ticketWithUsers.queueId}-${ticketWithUsers.status}`)
            .to(`queue-${ticketWithUsers.queueId}-notification`)
            .to(ticketId.toString())
            .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: ticketWithUsers
        });
        userIdsToNotify.forEach((uid) => {
            io.to(`user-${uid}`).emit(`company-${companyId}-ticket`, {
                action: "update",
                ticket: ticketWithUsers
            });
        });
        if (ticketWithUsers.isGroup && hasTicketUsersChanged) {
            io.to(`company-${companyId}-pending`)
                .to(`company-${companyId}-notification`)
                .emit(`company-${companyId}-ticket`, {
                action: "update",
                ticket: ticketWithUsers
            });
        }
        return { ticket: ticketWithUsers, oldStatus, oldUserId };
    }
    catch (err) {
        Sentry.captureException(err);
        throw err;
    }
};
exports.default = UpdateTicketService;
