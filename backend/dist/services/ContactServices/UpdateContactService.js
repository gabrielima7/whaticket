"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Contact_1 = __importDefault(require("../../models/Contact"));
const ContactCustomField_1 = __importDefault(require("../../models/ContactCustomField"));
const UpdateContactService = async ({ contactData, contactId, companyId }) => {
    const { email, name, number, extraInfo, active, disableBot, birthday } = contactData;
    const contact = await Contact_1.default.findOne({
        where: { id: contactId },
        attributes: ["id", "name", "number", "lid", "email", "companyId", "profilePicUrl", "active"],
        include: ["extraInfo"]
    });
    if (contact?.companyId !== companyId) {
        throw new AppError_1.default("Não é possível alterar registros de outra empresa");
    }
    if (!contact) {
        throw new AppError_1.default("ERR_NO_CONTACT_FOUND", 404);
    }
    if (extraInfo) {
        await Promise.all(extraInfo.map(async (info) => {
            await ContactCustomField_1.default.upsert({ ...info, contactId: contact.id });
        }));
        await Promise.all(contact.extraInfo.map(async (oldInfo) => {
            const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);
            if (stillExists === -1) {
                await ContactCustomField_1.default.destroy({ where: { id: oldInfo.id } });
            }
        }));
    }
    // Trata a data de aniversário para evitar problemas de timezone
    // O campo DATEONLY do Sequelize espera uma string YYYY-MM-DD ou Date em UTC
    let birthdayDate = null;
    if (birthday) {
        const dateStr = birthday.toString();
        // Se já está no formato YYYY-MM-DD, cria Date em UTC para manter a data correta
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            // Extrai ano, mês e dia e cria Date em UTC (meio-dia UTC para evitar problemas)
            const [year, month, day] = dateStr.split('-').map(Number);
            birthdayDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        }
        else if (dateStr.includes('T')) {
            // Se tem timestamp, extrai apenas a data e cria em UTC
            const date = new Date(dateStr);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const day = date.getUTCDate();
            birthdayDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
        }
        else {
            // Tenta converter para Date em UTC
            const date = new Date(dateStr);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const day = date.getUTCDate();
            birthdayDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
        }
    }
    await contact.update({
        name,
        number,
        email,
        active,
        disableBot,
        birthday: birthdayDate
    });
    await contact.reload({
        attributes: ["id", "name", "number", "lid", "email", "profilePicUrl", "active"],
        include: ["extraInfo"]
    });
    return contact;
};
exports.default = UpdateContactService;
