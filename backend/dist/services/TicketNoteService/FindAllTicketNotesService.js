"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TicketNote_1 = __importDefault(require("../../models/TicketNote"));
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const FindAllTicketNotesService = async (companyId) => {
    const include = companyId
        ? [{ model: Ticket_1.default, as: "ticket", where: { companyId }, attributes: [] }]
        : [];
    const ticketNote = await TicketNote_1.default.findAll({ include });
    return ticketNote;
};
exports.default = FindAllTicketNotesService;
