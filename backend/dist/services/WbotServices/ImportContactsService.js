"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const wbot_1 = require("../../libs/wbot");
const Contact_1 = __importDefault(require("../../models/Contact"));
const logger_1 = require("../../utils/logger");
const ShowBaileysService_1 = __importDefault(require("../BaileysServices/ShowBaileysService"));
const CreateContactService_1 = __importDefault(require("../ContactServices/CreateContactService"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const GetDefaultWhatsApp_1 = __importDefault(require("../../helpers/GetDefaultWhatsApp"));
const ImportContactsService = async (companyId, whatsappId) => {
    // Define qual conexão WhatsApp usar:
    // - Se vier whatsappId no corpo da requisição, usa essa conexão
    // - Caso contrário, usa o WhatsApp padrão da empresa (comportamento anterior)
    let targetWhatsappId = whatsappId;
    if (!targetWhatsappId) {
        const defaultWhatsapp = await (0, GetDefaultWhatsApp_1.default)(companyId);
        targetWhatsappId = defaultWhatsapp.id;
    }
    const whatsapp = await Whatsapp_1.default.findOne({
        where: {
            id: targetWhatsappId,
            companyId,
            status: "CONNECTED"
        }
    });
    if (!whatsapp) {
        throw new AppError_1.default("ERR_NO_WAPP_FOUND", 404);
    }
    const wbot = (0, wbot_1.getWbot)(whatsapp.id);
    const baileys = await (0, ShowBaileysService_1.default)(wbot.id);
    let phoneContactsList = [];
    try {
        const parsed = baileys.contacts && JSON.parse(baileys.contacts);
        // Normaliza o formato vindo do Baileys para sempre ter um array de contatos,
        // independente se vem como array, objeto ou aninhado em "contacts".
        if (Array.isArray(parsed)) {
            phoneContactsList = parsed;
        }
        else if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.contacts)) {
                phoneContactsList = parsed.contacts;
            }
            else {
                phoneContactsList = Object.values(parsed);
            }
        }
    }
    catch (error) {
        logger_1.logger.warn({ baileys }, `Could not get whatsapp contacts from database. Err: ${error}`);
        throw new AppError_1.default("Could not get whatsapp contacts from database.", 500);
    }
    if (Array.isArray(phoneContactsList) && phoneContactsList.length) {
        for (const { id, name, notify } of phoneContactsList) {
            if (id === "status@broadcast" || id.includes("g.us"))
                continue;
            // Suporta números de qualquer país (até 15 dígitos conforme padrão internacional)
            const number = id.replace(/\D/g, "").slice(0, 15);
            const existingContact = await Contact_1.default.findOne({
                where: { number, companyId }
            });
            if (existingContact) {
                existingContact.name = name || notify || number;
                await existingContact.save();
            }
            else {
                try {
                    await (0, CreateContactService_1.default)({
                        number,
                        name: name || notify || number,
                        companyId
                    });
                }
                catch (error) {
                    logger_1.logger.error({ name, number, companyId }, `Could not save contact. Err: ${error}`);
                }
            }
        }
    }
};
exports.default = ImportContactsService;
