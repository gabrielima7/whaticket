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
const AppError_1 = __importDefault(require("../../errors/AppError"));
const CheckContactOpenTickets_1 = __importDefault(require("../../helpers/CheckContactOpenTickets"));
const GetDefaultWhatsApp_1 = __importDefault(require("../../helpers/GetDefaultWhatsApp"));
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const ShowContactService_1 = __importDefault(require("../ContactServices/ShowContactService"));
const socket_1 = require("../../libs/socket");
const GetDefaultWhatsAppByUser_1 = __importDefault(require("../../helpers/GetDefaultWhatsAppByUser"));
const ShowWhatsAppService_1 = __importDefault(require("../WhatsappService/ShowWhatsAppService"));
const CreateTicketService = async ({ contactId, status, userId, queueId, companyId, whatsappId }) => {
    let whatsapp;
    if (whatsappId !== undefined && whatsappId !== null && whatsappId !== "") {
        whatsapp = await (0, ShowWhatsAppService_1.default)(whatsappId, companyId);
    }
    let defaultWhatsapp = await (0, GetDefaultWhatsAppByUser_1.default)(userId);
    if (whatsapp) {
        defaultWhatsapp = whatsapp;
    }
    if (!defaultWhatsapp)
        defaultWhatsapp = await (0, GetDefaultWhatsApp_1.default)(companyId);
    const existingTicket = await (0, CheckContactOpenTickets_1.default)(contactId, whatsappId, companyId);
    if (existingTicket) {
        // Obter informações do usuário que está atendendo (já incluído na busca)
        let userName = "Nenhum atendente";
        if (existingTicket.user && existingTicket.user.name) {
            userName = existingTicket.user.name;
        }
        else if (existingTicket.userId) {
            // Se não veio no include, buscar separadamente
            const User = (await Promise.resolve().then(() => __importStar(require("../../models/User")))).default;
            const attendingUser = await User.findByPk(existingTicket.userId, {
                attributes: ["id", "name", "email"]
            });
            if (attendingUser) {
                userName = attendingUser.name;
            }
        }
        throw new AppError_1.default(`TICKET_ALREADY_OPEN|${userName}|${existingTicket.userId || ""}`, 409);
    }
    const { isGroup } = await (0, ShowContactService_1.default)(contactId, companyId);
    const [{ id }] = await Ticket_1.default.findOrCreate({
        where: {
            contactId,
            companyId,
            whatsappId
        },
        defaults: {
            contactId,
            companyId,
            whatsappId: defaultWhatsapp.id,
            status,
            isGroup,
            userId
        }
    });
    await Ticket_1.default.update({ companyId, queueId, userId, whatsappId: defaultWhatsapp.id, status: "open" }, { where: { id } });
    const ticket = await Ticket_1.default.findByPk(id, { include: ["contact", "queue"] });
    if (!ticket) {
        throw new AppError_1.default("ERR_CREATING_TICKET");
    }
    const io = (0, socket_1.getIO)();
    io.to(ticket.id.toString()).emit("ticket", {
        action: "update",
        ticket
    });
    return ticket;
};
exports.default = CreateTicketService;
