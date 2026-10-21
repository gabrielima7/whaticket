"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const EnsurePermissions_1 = require("../helpers/EnsurePermissions");
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
exports.default = {
    directory: publicFolder,
    storage: multer_1.default.diskStorage({
        destination: async function (req, file, cb) {
            try {
                let companyId = req.user?.companyId;
                const { typeArch, fileId } = req.body;
                if (!companyId) {
                    const authHeader = req.headers.authorization;
                    if (!authHeader || !authHeader.startsWith("Bearer ")) {
                        return cb(new AppError_1.default("Acesso não permitido", 401), "");
                    }
                    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
                    if (!token) {
                        return cb(new AppError_1.default("Acesso não permitido", 401), "");
                    }
                    const whatsapp = await Whatsapp_1.default.findOne({ where: { token } });
                    if (!whatsapp) {
                        return cb(new AppError_1.default("Acesso não permitido", 401), "");
                    }
                    companyId = whatsapp.companyId;
                }
                const safeCompanyId = Number(companyId);
                if (isNaN(safeCompanyId) || safeCompanyId <= 0) {
                    return cb(new AppError_1.default("Empresa inválida", 400), "");
                }
                let folder;
                if (typeArch === "stickers") {
                    folder = path_1.default.resolve(publicFolder, `company${safeCompanyId}`, "stickers", "salvos");
                }
                else if (typeArch === "announcements") {
                    folder = path_1.default.resolve(publicFolder, "announcements");
                }
                else if (typeArch === "logo") {
                    folder = path_1.default.resolve(publicFolder);
                }
                else if (typeArch) {
                    const safeTypeArch = String(typeArch).replace(/[^a-zA-Z0-9_-]/g, "");
                    const safeFileId = fileId ? String(fileId).replace(/[^a-zA-Z0-9_-]/g, "") : "";
                    folder = path_1.default.resolve(publicFolder, `company${safeCompanyId}`, safeTypeArch, safeFileId);
                }
                else {
                    folder = path_1.default.resolve(publicFolder, `company${safeCompanyId}`);
                }
                const allowedBase = path_1.default.resolve(publicFolder);
                if (!folder.startsWith(allowedBase + path_1.default.sep) && folder !== allowedBase) {
                    return cb(new AppError_1.default("Tentativa de Path Traversal detectada", 403), "");
                }
                (0, EnsurePermissions_1.ensureFolderPermissions)(folder);
                return cb(null, folder);
            }
            catch (err) {
                return cb(err, "");
            }
        },
        filename(req, file, cb) {
            const rawExt = path_1.default.extname(file.originalname).toLowerCase();
            const dangerousExtensions = [".html", ".htm", ".svg", ".php", ".phtml", ".exe", ".sh", ".bash", ".bat", ".cmd", ".js", ".mjs", ".ts", ".py", ".rb", ".pl"];
            const ext = dangerousExtensions.includes(rawExt) ? ".txt" : rawExt;
            const rawName = path_1.default.basename(file.originalname, rawExt);
            const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
            const timestamp = Date.now();
            const fileName = `${timestamp}_${sanitizedName}${ext}`;
            return cb(null, fileName);
        }
    })
};
