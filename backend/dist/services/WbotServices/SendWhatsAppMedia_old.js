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
exports.getMessageOptions = void 0;
const Sentry = __importStar(require("@sentry/node"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const GetTicketWbot_1 = __importDefault(require("../../helpers/GetTicketWbot"));
const mime_types_1 = __importDefault(require("mime-types"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "..", "public");
const processAudio = async (audio, companyId) => {
    const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`${ffmpeg_static_1.default} -i ${audio} -vn -c:a libopus -b:a 128k ${outputAudio} -y`, (error, _stdout, _stderr) => {
            if (error)
                reject(error);
            fs_1.default.unlinkSync(audio);
            resolve(outputAudio);
        });
    });
};
const processAudioFile = async (audio, companyId) => {
    const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.mp3`;
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`${ffmpeg_static_1.default} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`, (error, _stdout, _stderr) => {
            if (error)
                reject(error);
            fs_1.default.unlinkSync(audio);
            resolve(outputAudio);
        });
    });
};
const getMessageOptions = async (fileName, pathMedia, companyId, body = " ") => {
    const mimeType = mime_types_1.default.lookup(pathMedia);
    const typeMessage = mimeType.split("/")[0];
    try {
        if (!mimeType) {
            throw new Error("Invalid mimetype");
        }
        let options;
        if (typeMessage === "video") {
            options = {
                video: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName
            };
        }
        else if (typeMessage === "audio") {
            const typeAudio = true;
            const convert = await processAudio(pathMedia, companyId);
            if (typeAudio) {
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true,
                };
            }
            else {
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: typeAudio ? "audio/mp4" : mimeType,
                    ptt: true
                };
            }
        }
        else if (typeMessage === "document" || fileName.endsWith('.psd')) {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else if (typeMessage === "application") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else {
            options = {
                image: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
            };
        }
        return options;
    }
    catch (e) {
        Sentry.captureException(e);
        console.log(e);
        return null;
    }
};
exports.getMessageOptions = getMessageOptions;
const SendWhatsAppMedia = async ({ media, ticket, body, isForwarded = false }) => {
    try {
        const wbot = await (0, GetTicketWbot_1.default)(ticket);
        const companyId = ticket.companyId.toString();
        const pathMedia = media.path;
        const mimeType = media.mimetype;
        const typeMessage = mimeType.split("/")[0];
        const fileName = media.originalname.replace('/', '-');
        let options;
        const bodyMessage = (0, Mustache_1.default)(body, ticket.contact);
        // Lista de tipos MIME de vídeo comuns
        const videoMimeTypes = [
            'video/mp4',
            'video/3gpp',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-ms-wmv',
            'video/x-matroska',
            'video/webm',
            'video/ogg'
        ];
        // Lista de extensões que devem ser tratadas como documento
        const documentExtensions = ['.psd', '.ai', '.eps', '.indd', '.xd', '.sketch'];
        // Verifica se é um arquivo PSD ou similar (deve ser tratado como documento)
        const shouldBeDocument = documentExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
        if (shouldBeDocument) {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: bodyMessage,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        // Verifica se é um vídeo (incluindo vários formatos)
        else if (typeMessage === "video" || videoMimeTypes.includes(mimeType)) {
            options = {
                video: fs_1.default.readFileSync(pathMedia),
                caption: bodyMessage,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else if (typeMessage === "audio") {
            // Verifica se o arquivo já é OGG
            if (mimeType === "audio/ogg") {
                options = {
                    audio: fs_1.default.readFileSync(pathMedia),
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                };
            }
            else {
                // Converte para OGG se não for
                const convert = await processAudio(pathMedia, companyId);
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                };
            }
        }
        else if (typeMessage === "document" || mimeType === "application/pdf") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: bodyMessage,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else if (typeMessage === "image") {
            options = {
                image: fs_1.default.readFileSync(pathMedia),
                caption: bodyMessage
            };
        }
        else {
            // Caso o tipo de mídia não seja reconhecido, trata como documento
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: bodyMessage,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        const sentMessage = await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, {
            ...options
        });
        await ticket.update({ lastMessage: bodyMessage });
        return sentMessage;
    }
    catch (err) {
        Sentry.captureException(err);
        console.log(err);
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
};
exports.default = SendWhatsAppMedia;
