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
exports.edit = exports.forwardMessage = exports.addReaction = exports.send = exports.remove = exports.store = exports.index = void 0;
const AppError_1 = __importDefault(require("../errors/AppError"));
const Mustache_1 = __importDefault(require("../helpers/Mustache"));
const SetTicketMessagesAsRead_1 = __importDefault(require("../helpers/SetTicketMessagesAsRead"));
const socket_1 = require("../libs/socket");
const Ticket_1 = __importDefault(require("../models/Ticket"));
const Message_1 = __importDefault(require("../models/Message"));
const Queue_1 = __importDefault(require("../models/Queue"));
const User_1 = __importDefault(require("../models/User"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const Sentry = __importStar(require("@sentry/node"));
const mime_types_1 = require("mime-types");
const lodash_1 = require("lodash");
const CreateOrUpdateContactService_1 = __importDefault(require("../services/ContactServices/CreateOrUpdateContactService"));
const SendWhatsAppReaction_1 = __importDefault(require("../services/WbotServices/SendWhatsAppReaction"));
const ListMessagesService_1 = __importDefault(require("../services/MessageServices/ListMessagesService"));
const FindOrCreateTicketService_1 = __importDefault(require("../services/TicketServices/FindOrCreateTicketService"));
const ShowTicketService_1 = __importDefault(require("../services/TicketServices/ShowTicketService"));
const UpdateTicketService_1 = __importDefault(require("../services/TicketServices/UpdateTicketService"));
const CheckNumber_1 = __importDefault(require("../services/WbotServices/CheckNumber"));
const DeleteWhatsAppMessage_1 = __importDefault(require("../services/WbotServices/DeleteWhatsAppMessage"));
const GetProfilePicUrl_1 = __importDefault(require("../services/WbotServices/GetProfilePicUrl"));
const ShowContactService_1 = __importDefault(require("../services/ContactServices/ShowContactService"));
const SendWhatsAppMedia_1 = __importDefault(require("../services/WbotServices/SendWhatsAppMedia"));
//import SendWhatsAppMediaInternal from "../services/WbotServices/SendWhatsAppMediaInternal";
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const SendWhatsAppMessage_1 = __importDefault(require("../services/WbotServices/SendWhatsAppMessage"));
const EditWhatsAppMessage_1 = __importDefault(require("../services/WbotServices/EditWhatsAppMessage"));
const ShowMessageService_1 = __importStar(require("../services/MessageServices/ShowMessageService"));
const GetTicketWbot_1 = __importDefault(require("../helpers/GetTicketWbot"));
const global_1 = require("../utils/global");
const CreateMessageService_1 = __importDefault(require("../services/MessageServices/CreateMessageService"));
const index = async (req, res) => {
    const { ticketId } = req.params;
    const { pageNumber } = req.query;
    const { companyId, profile } = req.user;
    const queues = [];
    if (profile !== "admin") {
        const user = await User_1.default.findByPk(req.user.id, {
            include: [{ model: Queue_1.default, as: "queues" }]
        });
        user.queues.forEach(queue => {
            queues.push(queue.id);
        });
    }
    const { count, messages, ticket, hasMore } = await (0, ListMessagesService_1.default)({
        pageNumber,
        ticketId,
        companyId,
        queues
    });
    (0, SetTicketMessagesAsRead_1.default)(ticket);
    return res.json({ count, messages, ticket, hasMore });
};
exports.index = index;
const store = async (req, res) => {
    const { ticketId } = req.params;
    const { body, quotedMsg, forceMediaType, stickerPath } = req.body;
    const medias = req.files;
    const { companyId } = req.user;
    const ticket = await (0, ShowTicketService_1.default)(ticketId, companyId);
    (0, SetTicketMessagesAsRead_1.default)(ticket);
    if (medias && medias.length > 0) {
        const hasStickerPath = stickerPath && forceMediaType === "sticker";
        if (hasStickerPath) {
            const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
            const fullPath = path_1.default.join(publicFolder, `company${companyId}`, stickerPath);
            if (fs_1.default.existsSync(fullPath)) {
                const fileName = path_1.default.basename(stickerPath);
                const mimetype = (0, mime_types_1.lookup)(fileName) || "image/webp";
                const mockMedia = {
                    fieldname: 'medias',
                    originalname: fileName,
                    encoding: '7bit',
                    mimetype,
                    destination: path_1.default.dirname(fullPath),
                    filename: fileName,
                    path: fullPath,
                    size: fs_1.default.statSync(fullPath).size,
                    stream: null,
                    buffer: null
                };
                await (0, SendWhatsAppMedia_1.default)({
                    media: mockMedia,
                    ticket,
                    body: body || "",
                    forceMediaType: "sticker",
                    skipSave: true
                });
                return res.send();
            }
        }
        await Promise.all(medias.map(async (media, index) => {
            await (0, SendWhatsAppMedia_1.default)({
                media,
                ticket,
                body: Array.isArray(body) ? body[index] : body,
                forceMediaType: forceMediaType
            });
        }));
    }
    else {
        const send = await (0, SendWhatsAppMessage_1.default)({ body, ticket, quotedMsg });
        const message = await (0, CreateMessageService_1.default)({
            messageData: {
                id: send.key.id,
                ticketId: ticket.id,
                body: (0, Mustache_1.default)(body, ticket.contact),
                fromMe: true,
                read: true,
                quotedMsgId: quotedMsg?.id,
                ack: send.status || 0,
                remoteJid: send.key.remoteJid,
                participant: send.key.participant,
                dataJson: JSON.stringify(send)
            },
            companyId
        });
        return res.status(200).json(message);
    }
    return res.send();
};
exports.store = store;
const remove = async (req, res) => {
    const { messageId } = req.params;
    const { companyId } = req.user;
    const message = await (0, DeleteWhatsAppMessage_1.default)(messageId);
    const io = (0, socket_1.getIO)();
    io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
        action: "update",
        message
    });
    return res.send();
};
exports.remove = remove;
const send = async (req, res) => {
    const { whatsappId } = req.params;
    const messageData = req.body;
    const medias = req.files;
    console.log('messageData;', messageData);
    try {
        const whatsapp = await Whatsapp_1.default.findByPk(whatsappId);
        if (!whatsapp) {
            throw new Error("Não foi possível realizar a operação");
        }
        if (messageData.number === undefined) {
            throw new Error("O número é obrigatório");
        }
        // Normaliza o número para o padrão esperado pelo WhatsApp/Baileys (somente dígitos).
        // Evita JID inválido quando o cliente envia "+55 800 042 0909".
        const numberToTest = `${messageData.number}`.replace(/\D/g, "").slice(0, 15);
        if (!numberToTest) {
            throw new Error("Número inválido");
        }
        const body = messageData.body;
        const companyId = whatsapp.companyId;
        const CheckValidNumber = await (0, CheckNumber_1.default)(numberToTest, companyId);
        const number = CheckValidNumber.jid.replace(/\D/g, "");
        const profilePicUrl = await (0, GetProfilePicUrl_1.default)(number, companyId);
        const contactData = {
            name: `${number}`,
            number,
            profilePicUrl,
            isGroup: false,
            companyId
        };
        const contact = await (0, CreateOrUpdateContactService_1.default)(contactData);
        const ticket = await (0, FindOrCreateTicketService_1.default)(contact, whatsapp.id, 0, companyId);
        if (medias) {
            await Promise.all(medias.map(async (media) => {
                await req.app.get("queues").messageQueue.add("SendMessage", {
                    whatsappId,
                    data: {
                        number,
                        body: body ? (0, Mustache_1.default)(body, contact) : "",
                        mediaPath: media.path,
                        fileName: media.originalname
                    }
                }, { removeOnComplete: true, attempts: 3 });
            }));
        }
        else {
            await (0, SendWhatsAppMessage_1.default)({ body: (0, Mustache_1.default)(body, contact), ticket });
            await ticket.update({
                lastMessage: body,
            });
        }
        if (messageData.closeTicket) {
            setTimeout(async () => {
                await (0, UpdateTicketService_1.default)({
                    ticketId: ticket.id,
                    ticketData: { status: "closed" },
                    companyId
                });
            }, 1000);
        }
        (0, SetTicketMessagesAsRead_1.default)(ticket);
        return res.send({ mensagem: "Mensagem enviada" });
    }
    catch (err) {
        if (Object.keys(err).length === 0) {
            throw new AppError_1.default("Não foi possível enviar a mensagem, tente novamente em alguns instantes");
        }
        else {
            throw new AppError_1.default(err.message);
        }
    }
};
exports.send = send;
const addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { type } = req.body; // O tipo de reação, por exemplo, 'like', 'heart', etc.
        const { companyId, id } = req.user;
        const message = await Message_1.default.findByPk(messageId);
        const ticket = await Ticket_1.default.findByPk(message.ticketId, {
            include: ["contact"]
        });
        if (!message) {
            return res.status(404).send({ message: "Mensagem não encontrada" });
        }
        // Envia a reação via WhatsApp
        const reactionResult = await (0, SendWhatsAppReaction_1.default)({
            messageId: messageId,
            ticket: ticket,
            reactionType: type
        });
        // Atualiza a mensagem com a nova reação no banco de dados (opcional, dependendo da necessidade)
        const updatedMessage = await message.update({
            reactions: [...message.reactions, { type: type, userId: Number(id) }]
        });
        const io = (0, socket_1.getIO)();
        io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
            action: "update",
            message
        });
        return res.status(200).send({
            message: 'Reação adicionada com sucesso!',
            reactionResult,
            reactions: updatedMessage.reactions
        });
    }
    catch (error) {
        console.error('Erro ao adicionar reação:', error);
        if (error instanceof AppError_1.default) {
            return res.status(400).send({ message: error.message });
        }
        return res.status(500).send({ message: 'Erro ao adicionar reação', error: error.message });
    }
};
exports.addReaction = addReaction;
function obterNomeEExtensaoDoArquivo(url) {
    var urlObj = new URL(url);
    var pathname = urlObj.pathname;
    var filename = pathname.split('/').pop();
    var parts = filename.split('.');
    var nomeDoArquivo = parts[0];
    var extensao = parts[1];
    return `${nomeDoArquivo}.${extensao}`;
}
const forwardMessage = async (req, res) => {
    const { quotedMsg, signMessage, messageId, contactId } = req.body;
    const { id: userId, companyId } = req.user;
    const requestUser = await User_1.default.findByPk(userId);
    if (!messageId || !contactId) {
        return res.status(200).send("MessageId or ContactId not found");
    }
    const message = await (0, ShowMessageService_1.default)(messageId);
    const contact = await (0, ShowContactService_1.default)(contactId, companyId);
    if (!message) {
        return res.status(404).send("Message not found");
    }
    if (!contact) {
        return res.status(404).send("Contact not found");
    }
    const whatsAppConnectionId = await (0, ShowMessageService_1.GetWhatsAppFromMessage)(message);
    if (!whatsAppConnectionId) {
        return res.status(404).send('Whatsapp from message not found');
    }
    const ticket = await (0, ShowTicketService_1.default)(message.ticketId, message.companyId);
    const createTicket = await (0, FindOrCreateTicketService_1.default)(contact, ticket?.whatsappId, 0, ticket.companyId, contact.isGroup ? contact : null);
    let ticketData;
    if ((0, lodash_1.isNil)(createTicket?.queueId)) {
        ticketData = {
            status: createTicket.isGroup ? "group" : "open",
            userId: requestUser.id,
            queueId: ticket.queueId
        };
    }
    else {
        ticketData = {
            status: createTicket.isGroup ? "group" : "open",
            userId: requestUser.id
        };
    }
    await (0, UpdateTicketService_1.default)({
        ticketData,
        ticketId: createTicket.id,
        companyId: createTicket.companyId
    });
    const isForwarded = message.fromMe ? false : true;
    const originalBody = message.body || "";
    let body = originalBody;
    const isTextMessage = message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage" ||
        message.mediaType === "editedMessage";
    const shouldSign = Boolean(signMessage && requestUser?.name);
    const isLocationMessage = message.mediaType === "locationMessage" ||
        message.mediaType === "liveLocationMessage";
    if (isLocationMessage) {
        let parsedData = null;
        try {
            parsedData = message.dataJson ? JSON.parse(message.dataJson) : null;
        }
        catch (error) {
            Sentry.captureException(error);
        }
        const locationMessage = parsedData?.message?.locationMessage || parsedData?.message?.liveLocationMessage;
        const rawBodyCoords = originalBody?.split("|")?.[2]?.split(",") || [];
        const latFromBody = rawBodyCoords[0] ? Number(rawBodyCoords[0].trim()) : null;
        const lonFromBody = rawBodyCoords[1] ? Number(rawBodyCoords[1].trim()) : null;
        const latitude = typeof locationMessage?.degreesLatitude === "number" ? locationMessage.degreesLatitude : latFromBody;
        const longitude = typeof locationMessage?.degreesLongitude === "number" ? locationMessage.degreesLongitude : lonFromBody;
        if (typeof latitude === "number" && !Number.isNaN(latitude) && typeof longitude === "number" && !Number.isNaN(longitude)) {
            const wbot = await (0, GetTicketWbot_1.default)(createTicket);
            await wbot.sendMessage((0, global_1.buildContactAddress)(createTicket.contact, createTicket.isGroup), {
                location: {
                    degreesLatitude: latitude,
                    degreesLongitude: longitude,
                    name: locationMessage?.name || locationMessage?.comment || undefined,
                    address: locationMessage?.address || undefined
                },
                contextInfo: {
                    forwardingScore: isForwarded ? 2 : 0,
                    isForwarded: isForwarded ? true : false
                }
            });
            return res.send();
        }
    }
    if (isTextMessage) {
        if (shouldSign) {
            body = `${originalBody}${originalBody ? "\n\n" : ""}${requestUser.name}`;
        }
        await (0, SendWhatsAppMessage_1.default)({ body, ticket: createTicket, quotedMsg, isForwarded });
        return res.send();
    }
    const mediaUrl = message.mediaUrl?.replace(`:${process.env.PORT}`, '');
    if (!mediaUrl) {
        return res.status(422).send("Media URL not available for forwarding");
    }
    let fileName;
    let filePath;
    const publicFolder = path_1.default.join(__dirname, '..', '..', 'public');
    const sourceCompanyId = message.companyId || createTicket.companyId;
    if (mediaUrl.includes('stickers/')) {
        fileName = mediaUrl;
        filePath = path_1.default.join(publicFolder, `company${sourceCompanyId}`, mediaUrl);
    }
    else {
        fileName = obterNomeEExtensaoDoArquivo(mediaUrl);
        filePath = path_1.default.join(publicFolder, `company${sourceCompanyId}`, fileName);
    }
    if (!fs_1.default.existsSync(filePath)) {
        const alternativePath = path_1.default.join(publicFolder, `company${sourceCompanyId}`, mediaUrl);
        if (fs_1.default.existsSync(alternativePath)) {
            filePath = alternativePath;
        }
        else {
            return res.status(404).send("Media file not found for forwarding");
        }
    }
    let caption = originalBody;
    if (caption === fileName || caption === path_1.default.basename(fileName)) {
        caption = "";
    }
    if (shouldSign) {
        caption = `${caption}${caption ? "\n\n" : ""}${requestUser.name}`;
    }
    const resolvedMimeRaw = (0, mime_types_1.lookup)(fileName) || message.mediaType || 'application/octet-stream';
    const resolvedMime = typeof resolvedMimeRaw === "string" && resolvedMimeRaw.includes("/")
        ? resolvedMimeRaw
        : 'application/octet-stream';
    const mediaSrc = {
        fieldname: 'medias',
        originalname: path_1.default.basename(fileName),
        encoding: '7bit',
        mimetype: resolvedMime,
        filename: path_1.default.basename(fileName),
        path: filePath
    };
    let forceMediaType;
    if (message.mediaType === "sticker") {
        forceMediaType = "sticker";
    }
    else if (message.mediaType === "gif") {
        forceMediaType = "gif";
    }
    else if (message.mediaType === "document" || message.mediaType === "application") {
        forceMediaType = "document";
    }
    await (0, SendWhatsAppMedia_1.default)({
        media: mediaSrc,
        ticket: createTicket,
        body: caption,
        isForwarded,
        forceMediaType
    });
    return res.send();
};
exports.forwardMessage = forwardMessage;
const edit = async (req, res) => {
    const { messageId } = req.params;
    const { companyId } = req.user;
    const { body } = req.body;
    console.log(body);
    const { ticket, message } = await (0, EditWhatsAppMessage_1.default)({ messageId, body });
    const io = (0, socket_1.getIO)();
    io.emit(`company-${companyId}-appMessage`, {
        action: "update",
        message,
        ticket: ticket,
        contact: ticket.contact,
    });
    return res.send();
};
exports.edit = edit;
