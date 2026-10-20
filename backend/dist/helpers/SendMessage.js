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
exports.SendMessage = void 0;
const Sentry = __importStar(require("@sentry/node"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const mime_types_1 = __importDefault(require("mime-types"));
const GetWhatsappWbot_1 = __importDefault(require("./GetWhatsappWbot"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const logger_1 = require("../utils/logger");
const SendMessage = async (whatsapp, messageData) => {
    let wbot;
    try {
        wbot = await (0, GetWhatsappWbot_1.default)(whatsapp);
    }
    catch (error) {
        logger_1.logger.error(`Failed to get Wbot for WhatsApp ID ${whatsapp.id}: ${error.message}`);
        throw new AppError_1.default(`ERR_GETTING_WAPP_BOT: ${error.message}`, 500);
    }
    const chatId = `${messageData.number}@s.whatsapp.net`;
    let messageContent;
    try {
        if (messageData.mediaPath) {
            const fullPath = path_1.default.resolve("public", `company${messageData.companyId}`, messageData.mediaPath);
            const fileName = path_1.default.basename(fullPath);
            const mimeType = mime_types_1.default.lookup(fullPath);
            if (!mimeType) {
                throw new AppError_1.default(`Could not determine mime type for media: ${fileName}`, 400);
            }
            const fileBuffer = await promises_1.default.readFile(fullPath);
            if (!fileBuffer || fileBuffer.length === 0) {
                throw new AppError_1.default(`Media file is empty: ${fileName}`, 400);
            }
            const fileType = mimeType.split("/")[0];
            const caption = messageData.body || "";
            switch (fileType) {
                case "image":
                    messageContent = {
                        image: fileBuffer,
                        mimetype: mimeType,
                        caption: caption,
                        fileName: fileName
                    };
                    break;
                case "video":
                    messageContent = {
                        video: fileBuffer,
                        mimetype: mimeType,
                        caption: caption,
                        fileName: fileName
                    };
                    break;
                case "audio":
                    const isPtt = mimeType.includes("ogg");
                    messageContent = {
                        audio: fileBuffer,
                        mimetype: mimeType,
                        ptt: isPtt,
                        fileName: fileName
                    };
                    if (!isPtt && caption) {
                        logger_1.logger.warn(`Caption for non-PTT audio might not be displayed: ${fileName}`);
                    }
                    break;
                default:
                    messageContent = {
                        document: fileBuffer,
                        mimetype: mimeType,
                        fileName: fileName,
                        caption: caption
                    };
                    break;
            }
        }
        else {
            if (!messageData.body.trim()) {
                throw new AppError_1.default("Cannot send an empty text message.", 400);
            }
            messageContent = { text: `\u200e${messageData.body}` };
        }
        logger_1.logger.debug(`Sending message to ${chatId} via WhatsApp ${whatsapp.id}`);
        const sentMessage = await wbot.sendMessage(chatId, messageContent);
        if (!sentMessage) {
            throw new AppError_1.default("Failed to send message: Wbot returned undefined", 500);
        }
        logger_1.logger.info(`Message sent successfully to ${chatId} (ID: ${sentMessage.key.id})`);
        return sentMessage;
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(`Error sending message to ${chatId}: ${err.message}`);
        if (err instanceof AppError_1.default) {
            throw err;
        }
        throw new AppError_1.default(`ERR_SENDING_WAPP_MSG: ${err.message}`, 500);
    }
};
exports.SendMessage = SendMessage;
