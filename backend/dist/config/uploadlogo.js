"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public", "logotipos");
exports.default = {
    directory: publicFolder,
    storage: multer_1.default.diskStorage({
        destination: publicFolder,
        filename(req, file, cb) {
            try {
                const rawRef = req.query.ref ? String(req.query.ref) : "logo";
                const sanitizedRef = rawRef.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
                if (!sanitizedRef) {
                    return cb(new AppError_1.default("Nome de referência do logotipo inválido", 400), "");
                }
                const ext = path_1.default.extname(file.originalname).toLowerCase();
                const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg"];
                const safeExt = allowedExtensions.includes(ext) ? ext : ".png";
                const desiredFileName = `${sanitizedRef}${safeExt}`;
                const targetPath = path_1.default.resolve(publicFolder, desiredFileName);
                if (!targetPath.startsWith(publicFolder + path_1.default.sep)) {
                    return cb(new AppError_1.default("Tentativa de Path Traversal detectada", 403), "");
                }
                return cb(null, desiredFileName);
            }
            catch (err) {
                return cb(err, "");
            }
        }
    })
};
