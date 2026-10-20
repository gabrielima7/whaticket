"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const lodash_1 = require("lodash");
const AppError_1 = __importDefault(require("../errors/AppError"));
const EnsurePermissions_1 = require("../helpers/EnsurePermissions");
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
exports.default = {
    directory: publicFolder,
    storage: multer_1.default.diskStorage({
        destination: async function (req, file, cb) {
            let companyId;
            companyId = req.user?.companyId;
            const { typeArch, fileId } = req.body;
            if (companyId === undefined && (0, lodash_1.isNil)(companyId) && (0, lodash_1.isEmpty)(companyId)) {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    throw new AppError_1.default("Acesso não permitido", 401);
                }
                const token = authHeader.replace(/^Bearer\s+/i, "").trim();
                if (!token) {
                    throw new AppError_1.default("Acesso não permitido", 401);
                }
                const whatsapp = await Whatsapp_1.default.findOne({ where: { token } });
                if (!whatsapp) {
                    throw new AppError_1.default("Acesso não permitido", 401);
                }
                companyId = whatsapp.companyId;
            }
            let folder;
            if (typeArch && typeArch === "stickers") {
                // Stickers salvos manualmente vão para company${companyId}/stickers/salvos
                folder = path_1.default.resolve(publicFolder, `company${companyId}`, "stickers", "salvos");
            }
            else if (typeArch && typeArch !== "announcements" && typeArch !== "logo") {
                folder = path_1.default.resolve(publicFolder, `company${companyId}`, typeArch, fileId ? fileId : "");
            }
            else if (typeArch && typeArch === "announcements") {
                folder = path_1.default.resolve(publicFolder, typeArch);
            }
            else if (typeArch === "logo") {
                folder = path_1.default.resolve(publicFolder);
            }
            else {
                folder = path_1.default.resolve(publicFolder, `company${companyId}`);
            }
            // Criar pasta se não existir E sempre garantir permissões corretas
            (0, EnsurePermissions_1.ensureFolderPermissions)(folder);
            return cb(null, folder);
        },
        filename(req, file, cb) {
            const { typeArch } = req.body;
            // Para stickers, usar timestamp + nome original PRESERVANDO a extensão original
            if (typeArch === "stickers") {
                const timestamp = new Date().getTime();
                // Preservar extensão original (gif, png, webp, etc)
                const ext = path_1.default.extname(file.originalname);
                const nameWithoutExt = path_1.default.basename(file.originalname, ext);
                const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_').replace('/', '-');
                // Manter a extensão original (não converter)
                const fileName = `${timestamp}_${sanitizedName}${ext}`;
                return cb(null, fileName);
            }
            const fileName = typeArch && typeArch !== "announcements" ? file.originalname.replace('/', '-').replace(/ /g, "_") : new Date().getTime() + '_' + file.originalname.replace('/', '-').replace(/ /g, "_");
            return cb(null, fileName);
        }
    })
};
