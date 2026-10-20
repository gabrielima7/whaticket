"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.download = exports.remove = exports.store = exports.index = void 0;
const socket_1 = require("../libs/socket");
const AppError_1 = __importDefault(require("../errors/AppError"));
const CreateBackupService_1 = __importDefault(require("../services/BackupServices/CreateBackupService"));
const ListBackupsService_1 = __importDefault(require("../services/BackupServices/ListBackupsService"));
const DeleteBackupService_1 = __importDefault(require("../services/BackupServices/DeleteBackupService"));
const DownloadBackupService_1 = __importDefault(require("../services/BackupServices/DownloadBackupService"));
const logger_1 = require("../utils/logger");
const index = async (req, res) => {
    const { pageNumber, searchParam } = req.query;
    const { backups, count, hasMore } = await (0, ListBackupsService_1.default)({
        pageNumber,
        searchParam
    });
    return res.json({ backups, count, hasMore });
};
exports.index = index;
const store = async (req, res) => {
    const backupId = await (0, CreateBackupService_1.default)();
    const io = (0, socket_1.getIO)();
    io.emit("backup-progress", {
        backupId,
        progress: 0,
        status: "started"
    });
    // Inicia o backup em background
    CreateBackupService_1.default.processBackup(backupId).catch((error) => {
        logger_1.logger.error(`Error processing backup ${backupId}:`, error);
        io.emit("backup-progress", {
            backupId,
            progress: 0,
            status: "error",
            error: error.message
        });
    });
    return res.json({ backupId, message: "Backup iniciado" });
};
exports.store = store;
const remove = async (req, res) => {
    const { backupId } = req.params;
    await (0, DeleteBackupService_1.default)(backupId);
    return res.status(200).json({ message: "Backup excluído com sucesso" });
};
exports.remove = remove;
const download = async (req, res) => {
    const { backupId } = req.params;
    const filePath = await (0, DownloadBackupService_1.default)(backupId);
    res.download(filePath, (err) => {
        if (err) {
            logger_1.logger.error(`Error downloading backup ${backupId}:`, err);
            throw new AppError_1.default("Erro ao fazer download do backup", 500);
        }
    });
};
exports.download = download;
