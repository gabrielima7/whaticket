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
            let companyId;
            if (req.user?.companyId) {
                companyId = req.user.companyId;
            }
            else {
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
            const companyFolder = `${publicFolder}/company${companyId}`;
            const folder = `${companyFolder}/quick/`;
            // Criar pastas e garantir permissões corretas
            (0, EnsurePermissions_1.ensureFolderPermissions)(companyFolder);
            (0, EnsurePermissions_1.ensureFolderPermissions)(folder);
            return cb(null, folder);
        },
        filename(req, file, cb) {
            const fileName = `${new Date().getTime()}_${file.originalname.replace("/", "-")}`;
            return cb(null, fileName);
        }
    })
};
