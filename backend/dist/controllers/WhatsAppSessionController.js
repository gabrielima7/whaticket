"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ShowWhatsAppService_1 = __importDefault(require("../services/WhatsappService/ShowWhatsAppService"));
const StartWhatsAppSession_1 = require("../services/WbotServices/StartWhatsAppSession");
const GetWhatsAppSender_1 = require("../helpers/GetWhatsAppSender");
const store = async (req, res) => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;
    const whatsapp = await (0, ShowWhatsAppService_1.default)(whatsappId, companyId);
    await (0, StartWhatsAppSession_1.StartWhatsAppSession)(whatsapp, companyId);
    return res.status(200).json({ message: "Starting session." });
};
const update = async (req, res) => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;
    const whatsapp = await (0, ShowWhatsAppService_1.default)(whatsappId, companyId);
    await whatsapp.update({ session: "" });
    await (0, StartWhatsAppSession_1.StartWhatsAppSession)(whatsapp, companyId);
    return res.status(200).json({ message: "Starting session." });
};
const remove = async (req, res) => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;
    const whatsapp = await (0, ShowWhatsAppService_1.default)(whatsappId, companyId);
    if (whatsapp.session || whatsapp.status === "CONNECTED") {
        await whatsapp.update({ status: "DISCONNECTED", session: "" });
        try {
            const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(whatsapp.id);
            if (sender.logout)
                await sender.logout();
        }
        catch (_e) {
            // Session pode não existir em memória (ex.: reinício do servidor)
        }
    }
    return res.status(200).json({ message: "Session disconnected." });
};
exports.default = { store, remove, update };
