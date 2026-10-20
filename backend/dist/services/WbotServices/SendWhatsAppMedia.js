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
const global_1 = require("../../utils/global");
const wbotMessageListener_1 = require("./wbotMessageListener");
const EnsurePermissions_1 = require("../../helpers/EnsurePermissions");
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "..", "public");
const processAudio = async (audio, companyId) => {
    const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`${ffmpeg_static_1.default} -i ${audio} -vn -c:a libopus -b:a 128k ${outputAudio} -y`, (error, _stdout, _stderr) => {
            if (error)
                reject(error);
            fs_1.default.unlinkSync(audio);
            // CORRIGIR PERMISSÕES DO ARQUIVO DE ÁUDIO CONVERTIDO
            try {
                if (fs_1.default.existsSync(outputAudio)) {
                    fs_1.default.chmodSync(outputAudio, 0o777);
                }
            }
            catch (err) {
                console.log(`Aviso: Não foi possível alterar permissões do áudio: ${outputAudio}`);
            }
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
            // CORRIGIR PERMISSÕES DO ARQUIVO DE ÁUDIO CONVERTIDO
            try {
                if (fs_1.default.existsSync(outputAudio)) {
                    fs_1.default.chmodSync(outputAudio, 0o777);
                }
            }
            catch (err) {
                console.log(`Aviso: Não foi possível alterar permissões do áudio: ${outputAudio}`);
            }
            resolve(outputAudio);
        });
    });
};
const processGifToMp4 = async (gifPath, companyId) => {
    const outputVideo = `${publicFolder}/company${companyId}/${new Date().getTime()}.mp4`;
    return new Promise((resolve, reject) => {
        // Verificar se o arquivo GIF existe
        if (!fs_1.default.existsSync(gifPath)) {
            reject(new Error(`Arquivo GIF não encontrado: ${gifPath}`));
            return;
        }
        // Verificar se o FFmpeg está disponível
        if (!ffmpeg_static_1.default) {
            reject(new Error("FFmpeg não está disponível. Instale o ffmpeg-static."));
            return;
        }
        const ffmpegCommand = (0, fluent_ffmpeg_1.default)(gifPath)
            .outputOptions([
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-an',
            '-shortest',
            '-y'
        ])
            .output(outputVideo)
            .on('end', () => {
            if (!fs_1.default.existsSync(outputVideo)) {
                reject(new Error(`Arquivo MP4 não foi criado: ${outputVideo}`));
                return;
            }
            const stats = fs_1.default.statSync(outputVideo);
            if (stats.size === 0) {
                reject(new Error(`Arquivo MP4 está vazio: ${outputVideo}`));
                return;
            }
            // CORRIGIR PERMISSÕES DO ARQUIVO MP4 CONVERTIDO
            try {
                fs_1.default.chmodSync(outputVideo, 0o777);
            }
            catch (err) {
                console.log(`Aviso: Não foi possível alterar permissões do arquivo MP4: ${outputVideo}`);
            }
            resolve(outputVideo);
        })
            .on('error', (err) => {
            reject(err);
        });
        // Executar a conversão
        ffmpegCommand.run();
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
const SendWhatsAppMedia = async ({ media, ticket, body, isForwarded = false, forceMediaType, skipSave = false }) => {
    try {
        const wbot = await (0, GetTicketWbot_1.default)(ticket);
        const companyId = ticket.companyId.toString();
        const pathMedia = media.path;
        const mimeType = media.mimetype;
        let typeMessage = mimeType.split("/")[0];
        const fileName = media.originalname.replace('/', '-');
        let options;
        const bodyMessage = (0, Mustache_1.default)(body, ticket.contact);
        let savedFileName;
        let savedFilePath;
        let fileToSend;
        if (skipSave) {
            savedFilePath = pathMedia;
            fileToSend = pathMedia;
            savedFileName = fileName;
        }
        else {
            const isSticker = forceMediaType === "sticker";
            const baseFolder = `${publicFolder}/company${companyId}`;
            const folder = isSticker ? `${baseFolder}/stickers` : baseFolder;
            // Criar pasta e garantir permissões corretas
            (0, EnsurePermissions_1.ensureFolderPermissions)(folder);
            const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                const existingFilePath = `${folder}/${fileName}`;
                if (fs_1.default.existsSync(existingFilePath)) {
                    savedFileName = fileName;
                    savedFilePath = existingFilePath;
                    fs_1.default.unlinkSync(existingFilePath);
                }
                else {
                    savedFileName = fileName;
                    savedFilePath = existingFilePath;
                }
            }
            else {
                const timestamp = new Date().getTime();
                savedFileName = `${timestamp}_${fileName}`;
                savedFilePath = `${folder}/${savedFileName}`;
            }
            // Copiar arquivo
            fs_1.default.copyFileSync(pathMedia, savedFilePath);
            // CORRIGIR PERMISSÕES DO ARQUIVO COPIADO
            (0, EnsurePermissions_1.ensureFilePermissions)(savedFilePath);
            fileToSend = savedFilePath;
        }
        if (forceMediaType === "sticker") {
            if (!fs_1.default.existsSync(fileToSend)) {
                throw new Error(`Arquivo de sticker não encontrado: ${fileToSend}`);
            }
            const stats = fs_1.default.statSync(fileToSend);
            if (stats.size === 0) {
                throw new Error(`Arquivo de sticker está vazio: ${fileToSend}`);
            }
            options = {
                sticker: fs_1.default.readFileSync(fileToSend),
                mimetype: mimeType || "image/webp"
            };
        }
        else if (forceMediaType === "gif" || mimeType === "image/gif" || fileName.toLowerCase().endsWith('.gif')) {
            // GIFs devem ser enviados como vídeo com gifPlayback: true (como no WhatsApp)
            // Se o arquivo for .gif, converter para MP4 primeiro
            let videoFileToSend = fileToSend;
            let finalMimetype = "image/gif";
            let isConverted = false;
            if (fileName.toLowerCase().endsWith('.gif') || mimeType === "image/gif") {
                try {
                    if (!fs_1.default.existsSync(fileToSend)) {
                        throw new Error(`Arquivo GIF não encontrado: ${fileToSend}`);
                    }
                    videoFileToSend = await processGifToMp4(fileToSend, companyId);
                    if (!fs_1.default.existsSync(videoFileToSend)) {
                        throw new Error(`Arquivo MP4 convertido não encontrado: ${videoFileToSend}`);
                    }
                    const stats = fs_1.default.statSync(videoFileToSend);
                    if (stats.size === 0) {
                        throw new Error(`Arquivo MP4 convertido está vazio: ${videoFileToSend}`);
                    }
                    finalMimetype = "video/mp4";
                    isConverted = true;
                }
                catch (err) {
                    videoFileToSend = fileToSend;
                    finalMimetype = "image/gif";
                }
            }
            else {
                finalMimetype = "video/mp4";
            }
            if (!fs_1.default.existsSync(videoFileToSend)) {
                throw new Error(`Arquivo para envio não encontrado: ${videoFileToSend}`);
            }
            const videoBuffer = fs_1.default.readFileSync(videoFileToSend);
            if (videoBuffer.length === 0) {
                throw new Error(`Arquivo para envio está vazio: ${videoFileToSend}`);
            }
            options = {
                video: videoBuffer,
                caption: bodyMessage || null,
                gifPlayback: true,
                mimetype: finalMimetype
            };
            if (isConverted && videoFileToSend !== fileToSend) {
                options._tempFile = videoFileToSend;
            }
        }
        else if (forceMediaType === "document") {
            // Se forceMediaType for "document", forçar como documento independente do tipo de arquivo
            options = {
                document: fs_1.default.readFileSync(fileToSend),
                caption: bodyMessage || null,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else {
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
                    document: fs_1.default.readFileSync(fileToSend),
                    caption: bodyMessage || null,
                    fileName: fileName,
                    mimetype: mimeType
                };
            }
            // Verifica se é um vídeo (incluindo vários formatos)
            // NOTA: GIFs já foram tratados acima, então não precisamos verificar novamente
            else if (typeMessage === "video" || videoMimeTypes.includes(mimeType)) {
                options = {
                    video: fs_1.default.readFileSync(fileToSend),
                    caption: bodyMessage || null,
                    fileName: fileName,
                    mimetype: mimeType
                };
            }
            else if (typeMessage === "audio") {
                // Verifica se o arquivo já é OGG
                if (mimeType === "audio/ogg") {
                    options = {
                        audio: fs_1.default.readFileSync(fileToSend),
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
                    document: fs_1.default.readFileSync(fileToSend),
                    caption: bodyMessage || null,
                    fileName: fileName,
                    mimetype: mimeType
                };
            }
            else if (typeMessage === "image") {
                options = {
                    image: fs_1.default.readFileSync(fileToSend),
                    caption: bodyMessage || null
                };
            }
            else {
                // Caso o tipo de mídia não seja reconhecido, trata como documento
                options = {
                    document: fs_1.default.readFileSync(fileToSend),
                    caption: bodyMessage || null,
                    fileName: fileName,
                    mimetype: mimeType
                };
            }
        }
        const content = {
            ...options,
            contextInfo: {
                forwardingScore: isForwarded ? 2 : 0,
                isForwarded: isForwarded ? true : false
            }
        };
        let sentMessage;
        try {
            sentMessage = await wbot.sendMessage((0, global_1.buildContactAddress)(ticket.contact, ticket.isGroup), content);
        }
        catch (sendError) {
            throw sendError;
        }
        await ticket.update({ lastMessage: bodyMessage || "📎 Mídia" });
        if (sentMessage) {
            let finalMediaUrl = savedFileName;
            if (forceMediaType === "sticker") {
                if (skipSave && savedFilePath) {
                    const pathParts = savedFilePath.split(`company${companyId}`);
                    if (pathParts.length > 1) {
                        finalMediaUrl = pathParts[1].replace(/\\/g, '/').replace(/^\//, '');
                    }
                }
                else if (!finalMediaUrl.startsWith('stickers/')) {
                    finalMediaUrl = `stickers/${savedFileName}`;
                }
            }
            sentMessage.mediaUrl = finalMediaUrl;
            sentMessage.mediaPath = savedFilePath;
            const isGif = forceMediaType === "gif" ||
                mimeType === "image/gif" ||
                fileName.toLowerCase().endsWith('.gif') ||
                savedFileName.toLowerCase().endsWith('.gif');
            if (isGif) {
                sentMessage.forceMediaType = "gif";
            }
            else if (forceMediaType === "sticker") {
                sentMessage.forceMediaType = "sticker";
            }
        }
        await (0, wbotMessageListener_1.verifyMessage)(sentMessage, ticket, ticket.contact);
        if (options._tempFile && fs_1.default.existsSync(options._tempFile)) {
            try {
                fs_1.default.unlinkSync(options._tempFile);
            }
            catch (err) {
            }
        }
        /*
        if (forceMediaType === "sticker" && savedFilePath) {
          try {
            const { isAnimatedWebP } = await import("../../utils/webpDetector");
            
            const stickersSalvosFolder = path.resolve(publicFolder, `company${ticket.companyId}`, "stickers", "salvos");
            if (!fs.existsSync(stickersSalvosFolder)) {
              fs.mkdirSync(stickersSalvosFolder, { recursive: true });
              fs.chmodSync(stickersSalvosFolder, 0o777);
            }
    
            const stickerFileName = path.basename(savedFilePath);
            const isAnimated = await isAnimatedWebP(savedFilePath);
            
            const ext = path.extname(stickerFileName).toLowerCase();
            let finalStickerFileName = stickerFileName;
            let finalStickerDestination = path.join(stickersSalvosFolder, stickerFileName);
            
            if (isAnimated && ext !== ".webp") {
              const nameWithoutExt = path.basename(stickerFileName, ext);
              finalStickerFileName = `${nameWithoutExt}.webp`;
              finalStickerDestination = path.join(stickersSalvosFolder, finalStickerFileName);
            }
            
            if (!fs.existsSync(finalStickerDestination)) {
              fs.copyFileSync(savedFilePath, finalStickerDestination);
              console.log(`Sticker copiado para galeria: ${finalStickerFileName}`);
            }
    
            const stickerPath = `stickers/salvos/${finalStickerFileName}`;
    
            const existingSticker = await Sticker.findOne({
              where: {
                companyId: ticket.companyId,
                path: stickerPath
              }
            });
    
            if (!existingSticker) {
              await Sticker.create({
                companyId: ticket.companyId,
                name: finalStickerFileName,
                path: stickerPath,
                mimetype: isAnimated ? "image/webp" : (mimeType || mime.lookup(finalStickerDestination) || "image/webp"),
                userId: null
              });
              console.log(`Sticker salvo no banco: ${stickerPath}`);
            } else if (isAnimated && existingSticker.mimetype !== "image/webp") {
              await existingSticker.update({ mimetype: "image/webp" });
              console.log(`Sticker atualizado para WebP animado: ${stickerPath}`);
            }
          } catch (err) {
            Sentry.captureException(err);
          }
        }
        */
        return sentMessage;
    }
    catch (err) {
        Sentry.captureException(err);
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
};
exports.default = SendWhatsAppMedia;
