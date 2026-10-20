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
const Queue_1 = __importDefault(require("../../models/Queue"));
const ShowTicketService_1 = __importDefault(require("./ShowTicketService"));
const ShowWhatsAppService_1 = __importDefault(require("../WhatsappService/ShowWhatsAppService"));
const SendWhatsAppMessage_1 = __importDefault(require("../WbotServices/SendWhatsAppMessage"));
const FindOrCreateATicketTrakingService_1 = __importDefault(require("./FindOrCreateATicketTrakingService"));
const GetTicketWbot_1 = __importDefault(require("../../helpers/GetTicketWbot"));
const wbotMessageListener_1 = require("../WbotServices/wbotMessageListener");
const ListSettingsServiceOne_1 = __importDefault(require("../SettingServices/ListSettingsServiceOne")); //NOVO//
const ShowUserService_1 = __importDefault(require("../UserServices/ShowUserService")); //NOVO//
const lodash_1 = require("lodash");
const User_1 = __importDefault(require("../../models/User"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const global_1 = require("../../utils/global");
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const TicketUser_1 = __importDefault(require("../../models/TicketUser"));
const UpdateTicketService = async ({ ticketData, ticketId, companyId }) => {
    try {
        let { status } = ticketData;
        let { queueId, userId, userIds, ticketUsers, whatsappId, lastMessage = null } = ticketData;
        let chatbot = ticketData.chatbot || false;
        let queueOptionId = ticketData.queueOptionId || null;
        let promptId = ticketData.promptId || null;
        let useIntegration = ticketData.useIntegration || false;
        let integrationId = ticketData.integrationId || null;
        console.log("ticketData", ticketData);
        const io = (0, socket_1.getIO)();
        const ticket = await (0, ShowTicketService_1.default)(ticketId, companyId);
        const ticketTraking = await (0, FindOrCreateATicketTrakingService_1.default)({
            ticketId,
            companyId,
            whatsappId: ticket.whatsappId
        });
        if ((0, lodash_1.isNil)(whatsappId)) {
            whatsappId = ticket.whatsappId?.toString();
        }
        await (0, SetTicketMessagesAsRead_1.default)(ticket);
        const oldStatus = ticket.status;
        const oldUserId = ticket.user?.id;
        const oldQueueId = ticket.queueId;
        // Verificar se o ticket já está aberto por outro usuário
        if (status === "open" && userId && oldStatus === "open" && oldUserId && oldUserId !== userId) {
            // Buscar informações do usuário que está atendendo
            const currentUser = await User_1.default.findByPk(oldUserId, {
                attributes: ["id", "name", "email"]
            });
            throw new AppError_1.default(`TICKET_ALREADY_OPEN|${currentUser?.name || "Atendente"}|${oldUserId}`, 409);
        }
        if (oldStatus === "closed" || Number(whatsappId) !== ticket.whatsappId) {
            // let otherTicket = await Ticket.findOne({
            //   where: {
            //     contactId: ticket.contactId,
            //     status: { [Op.or]: ["open", "pending", "group"] },
            //     whatsappId
            //   }
            // });
            // if (otherTicket) {
            //     otherTicket = await ShowTicketService(otherTicket.id, companyId)
            //     await ticket.update({status: "closed"})
            //     io.to(oldStatus).emit(`company-${companyId}-ticket`, {
            //       action: "delete",
            //       ticketId: ticket.id
            //     });
            //     return { ticket: otherTicket, oldStatus, oldUserId }
            // }
            await (0, CheckContactOpenTickets_1.default)(ticket.contact.id, whatsappId);
            chatbot = null;
            queueOptionId = null;
        }
        if (status === "closed") {
            // Verificar se a fila tem linkToGroup ativo
            let queueLinkToGroup = false;
            if (ticket.queueId) {
                const queue = await Queue_1.default.findByPk(ticket.queueId);
                queueLinkToGroup = queue?.linkToGroup || false;
            }
            // Se for ticket de grupo com linkToGroup ativo, não executar automações
            const shouldDisableAutomations = ticket.isGroup && queueLinkToGroup;
            if (!shouldDisableAutomations) {
                const { complationMessage, ratingMessage } = ticket.whatsappId
                    ? await (0, ShowWhatsAppService_1.default)(ticket.whatsappId, companyId)
                    : { complationMessage: null, ratingMessage: null };
                const settingEvaluation = await (0, ListSettingsServiceOne_1.default)({
                    companyId: companyId,
                    key: "userRating"
                });
                // Envia a mensagem de avaliação apenas se o ticket não estiver em status 'pendente'
                if (ticket.status !== "pending" && // Adiciona a verificação para evitar avaliação em status pendente
                    !ticket.isGroup &&
                    !ticket.contact.isGroup &&
                    !ticket.contact.disableBot &&
                    settingEvaluation?.value === "enabled") {
                    if (ticketTraking.ratingAt == null && ticketTraking.userId !== null) {
                        const bodyRatingMessage = `${ratingMessage ? ratingMessage + "\n\n" : ""}Digite de 1 a 5 para qualificar nosso atendimento:\n\n*1* - 😞 _Péssimo_\n*2* - 😕 _Ruim_\n*3* - 😐 _Neutro_\n*4* - 🙂 _Bom_\n*5* - 😊 _Ótimo_`;
                        await (0, SendWhatsAppMessage_1.default)({ body: bodyRatingMessage, ticket });
                        await ticketTraking.update({
                            ratingAt: (0, moment_1.default)().toDate()
                        });
                        // Remove o ticket da lista de abertos
                        io.to(`company-${ticket.companyId}-open`)
                            .to(`queue-${ticket.queueId}-open`)
                            .to(ticketId.toString())
                            .emit(`company-${ticket.companyId}-ticket`, {
                            action: "delete",
                            ticketId: ticket.id
                        });
                        return { ticket, oldStatus, oldUserId };
                    }
                    ticketTraking.ratingAt = (0, moment_1.default)().toDate();
                    ticketTraking.rated = false;
                }
                else {
                    // Envia apenas a mensagem de finalização se estiver configurada
                    ticketTraking.finishedAt = (0, moment_1.default)().toDate();
                    if (!ticket.isGroup &&
                        !ticket.contact.isGroup &&
                        !ticket.contact.disableBot &&
                        !(0, lodash_1.isNil)(complationMessage) &&
                        complationMessage !== "") {
                        const body = `\u200e${complationMessage}`;
                        const sentMessage = await (0, SendWhatsAppMessage_1.default)({ body, ticket });
                        await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticket, ticket.contact);
                    }
                }
            }
            else {
                // Para tickets de grupo com linkToGroup, apenas atualizar o status sem automações
                ticketTraking.finishedAt = (0, moment_1.default)().toDate();
            }
        }
        await ticket.update({
            promptId: null,
            integrationId: null,
            useIntegration: false,
            typebotStatus: false,
            typebotSessionId: null
        });
        if (queueId !== undefined && queueId !== null) {
            ticketTraking.queuedAt = (0, moment_1.default)().toDate();
        }
        const settingsTransfTicket = await (0, ListSettingsServiceOne_1.default)({ companyId: companyId, key: "sendMsgTransfTicket" });
        const settingsTransfTicketMessage = await (0, ListSettingsServiceOne_1.default)({ companyId: companyId, key: "sendMsgTransfTicketMessage" });
        const transferTemplateDefault = "{{ms}} {{name}}, seu atendimento foi transferido. Departamento: {{queue}}. Atendente: {{agent}}.";
        const transferTemplate = settingsTransfTicketMessage?.value?.trim() || transferTemplateDefault;
        const settingsGreetingAccepted = await (0, ListSettingsServiceOne_1.default)({ companyId: companyId, key: "sendGreetingAccepted" });
        const settingsGreetingAcceptedMessage = await (0, ListSettingsServiceOne_1.default)({ companyId: companyId, key: "sendGreetingAcceptedMessage" });
        const greetingTemplateDefault = "{{ms}} {{name}}, meu nome é {{agent}} e vou prosseguir com seu atendimento!";
        const greetingTemplate = settingsGreetingAcceptedMessage?.value?.trim() || greetingTemplateDefault;
        const hasQueueTransfer = !(0, lodash_1.isNil)(oldQueueId) && !(0, lodash_1.isNil)(queueId) && oldQueueId !== queueId;
        const hasAgentTransfer = !(0, lodash_1.isNil)(oldUserId) && !(0, lodash_1.isNil)(userId) && oldUserId !== userId;
        if (settingsTransfTicket?.value === "enabled" &&
            transferTemplate &&
            (hasQueueTransfer || hasAgentTransfer) &&
            !ticket.isGroup &&
            !ticket.contact.isGroup) {
            const queue = !(0, lodash_1.isNil)(queueId) ? await Queue_1.default.findByPk(queueId) : null;
            const oldQueue = !(0, lodash_1.isNil)(oldQueueId) ? await Queue_1.default.findByPk(oldQueueId) : null;
            const newAgent = !(0, lodash_1.isNil)(userId) ? await (0, ShowUserService_1.default)(userId) : null;
            const previousAgent = !(0, lodash_1.isNil)(oldUserId) ? await (0, ShowUserService_1.default)(oldUserId) : null;
            const messageBody = (0, Mustache_1.default)(transferTemplate, ticket.contact, {
                queue: queue?.name || "",
                agent: newAgent?.name || "",
                previousAgent: previousAgent?.name || "",
                previousQueue: oldQueue?.name || ""
            });
            if (messageBody.trim()) {
                const wbot = await (0, GetTicketWbot_1.default)(ticket);
                const queueChangedMessage = await wbot.sendMessage((0, global_1.buildContactAddress)(ticket.contact, ticket.isGroup), {
                    text: messageBody
                });
                await (0, wbotMessageListener_1.verifyMessage)(queueChangedMessage, ticket, ticket.contact);
            }
        }
        // Gerenciar múltiplos usuários se ticketUsers ou userIds for fornecido
        let hasTicketUsersChanged = false;
        if (ticketUsers !== undefined && Array.isArray(ticketUsers)) {
            // Verificar se houve mudança nos usuários
            const currentTicketUsers = await TicketUser_1.default.findAll({
                where: { ticketId: ticket.id }
            });
            const currentUserIds = currentTicketUsers.map(tu => tu.userId).sort();
            const newUserIds = ticketUsers.map(tu => tu.userId).sort();
            hasTicketUsersChanged = JSON.stringify(currentUserIds) !== JSON.stringify(newUserIds);
            // Remover todos os relacionamentos existentes
            await TicketUser_1.default.destroy({
                where: { ticketId: ticket.id }
            });
            // Criar novos relacionamentos com filas
            if (ticketUsers.length > 0) {
                await TicketUser_1.default.bulkCreate(ticketUsers.map(tu => ({
                    ticketId: ticket.id,
                    userId: tu.userId,
                    queueId: tu.queueId || null
                })));
            }
            // Se houver ticketUsers, usar o primeiro como userId principal para compatibilidade
            if (ticketUsers.length > 0) {
                userId = ticketUsers[0].userId;
                // Se o ticket for de grupo e tiver fila no primeiro usuário, vincular ao ticket também
                if (ticket.isGroup && ticketUsers[0].queueId) {
                    queueId = ticketUsers[0].queueId;
                }
            }
            else {
                userId = null;
            }
        }
        else if (userIds !== undefined && Array.isArray(userIds)) {
            // Compatibilidade com formato antigo (apenas userIds)
            await TicketUser_1.default.destroy({
                where: { ticketId: ticket.id }
            });
            if (userIds.length > 0) {
                await TicketUser_1.default.bulkCreate(userIds.map(uId => ({
                    ticketId: ticket.id,
                    userId: uId,
                    queueId: null
                })));
                userId = userIds[0];
            }
            else {
                userId = null;
            }
        }
        await ticket.update({
            status,
            queueId,
            userId,
            whatsappId,
            chatbot,
            queueOptionId,
            lastMessage: lastMessage !== null ? lastMessage : ticket.lastMessage
        });
        await ticket.reload();
        // Recarregar ticket com ticketUsers para emitir eventos
        const ticketWithUsers = await (0, ShowTicketService_1.default)(ticket.id, companyId);
        if (status === "pending") {
            await ticketTraking.update({
                whatsappId,
                queuedAt: (0, moment_1.default)().toDate(),
                startedAt: null,
                userId: null
            });
        }
        if (status === "open") {
            await ticketTraking.update({
                startedAt: (0, moment_1.default)().toDate(),
                ratingAt: null,
                rated: false,
                whatsappId,
                userId: ticket.userId
            });
            if (settingsGreetingAccepted?.value === "enabled" &&
                greetingTemplate &&
                !ticket.isGroup &&
                !ticket.contact.isGroup &&
                ticket.contact.disableBot !== true &&
                oldStatus !== "open") {
                const queue = ticket.queueId ? await Queue_1.default.findByPk(ticket.queueId) : null;
                const newAgent = ticket.userId ? await (0, ShowUserService_1.default)(ticket.userId) : null;
                const greetingBody = (0, Mustache_1.default)(greetingTemplate, ticket.contact, {
                    queue: queue?.name || "",
                    agent: newAgent?.name || ""
                });
                if (greetingBody.trim()) {
                    const wbot = await (0, GetTicketWbot_1.default)(ticket);
                    const sentMessage = await wbot.sendMessage((0, global_1.buildContactAddress)(ticket.contact, ticket.isGroup), {
                        text: greetingBody
                    });
                    await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticket, ticket.contact);
                }
            }
        }
        await ticketTraking.save();
        if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId || hasTicketUsersChanged) {
            io.to(`company-${companyId}-${oldStatus}`)
                .to(`queue-${ticket.queueId}-${oldStatus}`)
                .to(`user-${oldUserId}`)
                .emit(`company-${companyId}-ticket`, {
                action: "delete",
                ticketId: ticket.id
            });
        }
        // Emitir evento para todos os usuários atribuídos ao ticket
        const userIdsToNotify = [ticket?.userId, oldUserId].filter(Boolean);
        // Se houver ticketUsers, adicionar todos os userIds
        if (ticketWithUsers.ticketUsers && ticketWithUsers.ticketUsers.length > 0) {
            ticketWithUsers.ticketUsers.forEach((tu) => {
                if (tu.user && tu.user.id && !userIdsToNotify.includes(tu.user.id)) {
                    userIdsToNotify.push(tu.user.id);
                }
            });
        }
        // Emitir para canais padrão
        io.to(`company-${companyId}-${ticket.status}`)
            .to(`company-${companyId}-notification`)
            .to(`queue-${ticket.queueId}-${ticket.status}`)
            .to(`queue-${ticket.queueId}-notification`)
            .to(ticketId.toString())
            .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: ticketWithUsers
        });
        // Emitir para cada usuário atribuído individualmente (importante para grupos)
        userIdsToNotify.forEach((uid) => {
            io.to(`user-${uid}`).emit(`company-${companyId}-ticket`, {
                action: "update",
                ticket: ticketWithUsers
            });
        });
        // Se for grupo e houver mudança nos usuários, emitir também para status pending
        if (ticket.isGroup && hasTicketUsersChanged) {
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
