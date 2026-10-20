"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const certsFolder = path_1.default.resolve(__dirname, "..", "..", "certs");
if (!fs_1.default.existsSync(certsFolder)) {
    fs_1.default.mkdirSync(certsFolder, { recursive: true });
}
exports.default = {
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, certsFolder);
        },
        filename: (_req, _file, cb) => {
            const superAdminCompanyId = Number(process.env.SUPER_ADMIN_COMPANY_ID || 1);
            const filename = `gerencianet_${superAdminCompanyId}.p12`;
            cb(null, filename);
        }
    }),
    fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".p12")) {
            return cb(new Error("Certificado deve estar no formato .p12"));
        }
        cb(null, true);
    }
};
