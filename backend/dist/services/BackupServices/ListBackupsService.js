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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// O diretório de backups fica dentro do backend
const BACKEND_ROOT = process.cwd();
const BACKUP_DIR = path.join(BACKEND_ROOT, "backups");
const ListBackupsService = async ({ pageNumber = 1, searchParam = "" }) => {
    if (!fs.existsSync(BACKUP_DIR)) {
        return { backups: [], count: 0, hasMore: false };
    }
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter((file) => file.endsWith(".zip"));
    const backups = backupFiles
        .map((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const id = file.replace(".zip", "");
        return {
            id,
            name: file,
            size: stats.size,
            createdAt: stats.birthtime
        };
    })
        .filter((backup) => {
        if (!searchParam)
            return true;
        return backup.name.toLowerCase().includes(searchParam.toLowerCase());
    })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = Number(pageNumber) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const total = backups.length;
    const paginatedBackups = backups.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    return {
        backups: paginatedBackups,
        count: total,
        hasMore
    };
};
exports.default = ListBackupsService;
