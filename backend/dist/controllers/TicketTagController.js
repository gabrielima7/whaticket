"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.store = void 0;
const AppError_1 = __importDefault(require("../errors/AppError"));
const TicketTag_1 = __importDefault(require("../models/TicketTag"));
const Tag_1 = __importDefault(require("../models/Tag"));
const Ticket_1 = __importDefault(require("../models/Ticket"));
const store = async (req, res) => {
    const { ticketId, tagId } = req.params;
    const { companyId } = req.user;
    const ticket = await Ticket_1.default.findOne({
        where: { id: ticketId, companyId }
    });
    if (!ticket) {
        throw new AppError_1.default("Ticket não encontrado", 404);
    }
    const tag = await Tag_1.default.findOne({
        where: { id: tagId, companyId }
    });
    if (!tag) {
        throw new AppError_1.default("Tag não encontrada", 404);
    }
    try {
        const [ticketTag] = await TicketTag_1.default.findOrCreate({
            where: { ticketId: Number(ticketId), tagId: Number(tagId) }
        });
        return res.status(201).json(ticketTag);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to store ticket tag.' });
    }
};
exports.store = store;
const remove = async (req, res) => {
    const { ticketId } = req.params;
    const { companyId } = req.user;
    const ticket = await Ticket_1.default.findOne({
        where: { id: ticketId, companyId }
    });
    if (!ticket) {
        throw new AppError_1.default("Ticket não encontrado", 404);
    }
    try {
        const ticketTags = await TicketTag_1.default.findAll({ where: { ticketId } });
        const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);
        const tagsWithKanbanOne = await Tag_1.default.findAll({
            where: {
                id: tagIds,
                companyId,
                kanban: 1,
            },
        });
        const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
        if (tagIdsWithKanbanOne && tagIdsWithKanbanOne.length > 0) {
            await TicketTag_1.default.destroy({ where: { ticketId, tagId: tagIdsWithKanbanOne } });
        }
        return res.status(200).json({ message: 'Ticket tags removed successfully.' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to remove ticket tags.' });
    }
};
exports.remove = remove;
