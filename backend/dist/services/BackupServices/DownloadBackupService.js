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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
// O diretório de backups fica dentro do backend
const BACKEND_ROOT = process.cwd();
const BACKUP_DIR = path.resolve(BACKEND_ROOT, "backups");
const DownloadBackupService = async (backupId) => {
    if (!backupId || !/^[a-zA-Z0-9_-]+$/.test(backupId)) {
        throw new AppError_1.default("Identificador de backup inválido", 400);
    }
    const backupPath = path.resolve(BACKUP_DIR, `${backupId}.zip`);
    if (!backupPath.startsWith(BACKUP_DIR + path.sep)) {
        throw new AppError_1.default("Acesso não permitido", 403);
    }
    if (!fs.existsSync(backupPath)) {
        throw new AppError_1.default("Backup não encontrado", 404);
    }
    return backupPath;
};
exports.default = DownloadBackupService;
