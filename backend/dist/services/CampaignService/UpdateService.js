"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Campaign_1 = __importDefault(require("../../models/Campaign"));
const ContactList_1 = __importDefault(require("../../models/ContactList"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const UpdateService = async (data) => {
    const { id } = data;
    const record = await Campaign_1.default.findByPk(id);
    if (!record) {
        throw new AppError_1.default("ERR_NO_CAMPAIGN_FOUND", 404);
    }
    if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(data.status) === -1) {
        throw new AppError_1.default("Só é permitido alterar campanha Inativa e Programada", 400);
    }
    // Se tem data/hora agendada, garantir status PROGRAMADA para o job processar
    const hasScheduledAt = data.scheduledAt != null && String(data.scheduledAt).trim() !== "";
    if (hasScheduledAt && data.status === "INATIVA") {
        data.status = "PROGRAMADA";
    }
    await record.update(data);
    await record.reload({
        include: [
            { model: ContactList_1.default },
            { model: Whatsapp_1.default, attributes: ["id", "name"] }
        ]
    });
    return record;
};
exports.default = UpdateService;
