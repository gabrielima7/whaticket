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
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const archiver_1 = __importDefault(require("archiver"));
const socket_1 = require("../../libs/socket");
const logger_1 = require("../../utils/logger");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// O diretório de backups fica dentro do backend para evitar problemas de permissão
const BACKEND_ROOT = process.cwd();
const BACKUP_DIR = path.join(BACKEND_ROOT, "backups");
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, "..");
// Garante que o diretório de backups existe
const ensureBackupDir = () => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o755 });
        }
    }
    catch (error) {
        logger_1.logger.error(`Erro ao criar diretório de backups: ${error.message}`);
        throw new Error(`Não foi possível criar o diretório de backups: ${error.message}`);
    }
};
// Cria o diretório na inicialização
ensureBackupDir();
const emitProgress = (backupId, progress, status, message) => {
    const io = (0, socket_1.getIO)();
    const progressData = {
        backupId,
        progress,
        status
    };
    // Só adiciona error se o status for "error"
    if (status === "error" && message) {
        progressData.error = message;
    }
    io.emit("backup-progress", progressData);
};
const CreateBackupService = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupId = `backup-${timestamp}`;
    return backupId;
};
CreateBackupService.processBackup = async (backupId) => {
    // Garante que o diretório existe antes de começar
    ensureBackupDir();
    const tempDir = path.join(BACKUP_DIR, backupId);
    const zipPath = path.join(BACKUP_DIR, `${backupId}.zip`);
    try {
        // Cria diretório temporário
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true, mode: 0o755 });
        }
        emitProgress(backupId, 5, "preparing");
        // 1. Backup do banco de dados (10%)
        emitProgress(backupId, 10, "database");
        await backupDatabase(tempDir, backupId);
        emitProgress(backupId, 30, "database");
        // 2. Backup do backend (40%)
        emitProgress(backupId, 35, "backend");
        await backupBackend(tempDir);
        emitProgress(backupId, 60, "backend");
        // 3. Backup do frontend (70%)
        emitProgress(backupId, 65, "frontend");
        await backupFrontend(tempDir);
        emitProgress(backupId, 85, "frontend");
        // 4. Criar ZIP (90%)
        emitProgress(backupId, 90, "compressing");
        // Verifica se o diretório temporário existe e tem conteúdo
        if (!fs.existsSync(tempDir)) {
            logger_1.logger.error(`Diretório temporário não encontrado: ${tempDir}`);
            throw new Error("Diretório temporário não encontrado para compressão");
        }
        const tempDirContents = fs.readdirSync(tempDir);
        logger_1.logger.info(`Conteúdo do diretório temporário: ${tempDirContents.join(", ")}`);
        if (tempDirContents.length === 0) {
            logger_1.logger.error("Nenhum arquivo encontrado no diretório temporário para comprimir");
            throw new Error("Nenhum arquivo encontrado para comprimir");
        }
        logger_1.logger.info(`Iniciando compressão de ${tempDir} para ${zipPath}`);
        await createZip(tempDir, zipPath);
        logger_1.logger.info(`Compressão concluída com sucesso: ${zipPath}`);
        // Verifica se o arquivo ZIP foi criado
        if (!fs.existsSync(zipPath)) {
            throw new Error("Falha ao criar arquivo ZIP");
        }
        // 5. Limpar diretório temporário
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch (cleanupError) {
            logger_1.logger.warn(`Erro ao limpar diretório temporário: ${cleanupError.message}`);
            // Não falha o backup se não conseguir limpar
        }
        emitProgress(backupId, 100, "completed");
        logger_1.logger.info(`Backup ${backupId} concluído com sucesso`);
    }
    catch (error) {
        logger_1.logger.error(`Erro ao processar backup ${backupId}:`, error);
        emitProgress(backupId, 0, "error", error.message || "Erro desconhecido");
        // Limpa arquivos em caso de erro
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
        throw error;
    }
};
const backupDatabase = async (tempDir, backupId) => {
    const dbConfig = require("../../config/database");
    const dbBackupPath = path.join(tempDir, "database");
    if (!fs.existsSync(dbBackupPath)) {
        fs.mkdirSync(dbBackupPath, { recursive: true });
    }
    const dbFile = path.join(dbBackupPath, `${backupId}.sql`);
    try {
        if (dbConfig.dialect === "mysql") {
            await execFileAsync("mysqldump", [
                "-h", String(dbConfig.host),
                "-P", String(dbConfig.port || 3306),
                "-u", String(dbConfig.username),
                `--result-file=${dbFile}`,
                String(dbConfig.database)
            ], {
                env: {
                    ...process.env,
                    MYSQL_PWD: String(dbConfig.password || "")
                }
            });
        }
        else if (dbConfig.dialect === "postgres") {
            await execFileAsync("pg_dump", [
                "-h", String(dbConfig.host),
                "-p", String(dbConfig.port || 5432),
                "-U", String(dbConfig.username),
                "-d", String(dbConfig.database),
                "-f", dbFile
            ], {
                env: {
                    ...process.env,
                    PGPASSWORD: String(dbConfig.password || "")
                }
            });
        }
        else {
            throw new Error(`Dialeto de banco de dados não suportado: ${dbConfig.dialect}`);
        }
    }
    catch (error) {
        logger_1.logger.error("Erro ao fazer backup do banco de dados:", error);
        // Tenta método alternativo usando Sequelize
        throw new Error("Não foi possível fazer backup do banco de dados. Certifique-se de que mysqldump/pg_dump está instalado.");
    }
};
const backupBackend = async (tempDir) => {
    const backendDir = path.join(tempDir, "backend");
    const backendSource = path.join(PROJECT_ROOT, "backend");
    if (!fs.existsSync(backendSource)) {
        logger_1.logger.warn(`Diretório backend não encontrado: ${backendSource}`);
        return;
    }
    if (!fs.existsSync(backendDir)) {
        fs.mkdirSync(backendDir, { recursive: true });
    }
    await copyDirectory(backendSource, backendDir, [
        "node_modules",
        "dist",
        ".git",
        "backups",
        "*.log",
        ".env"
    ]);
};
const backupFrontend = async (tempDir) => {
    const frontendDir = path.join(tempDir, "frontend");
    const frontendSource = path.join(PROJECT_ROOT, "frontend");
    if (!fs.existsSync(frontendSource)) {
        logger_1.logger.warn(`Diretório frontend não encontrado: ${frontendSource}`);
        return;
    }
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
    }
    await copyDirectory(frontendSource, frontendDir, [
        "node_modules",
        ".git",
        "build",
        "dist",
        "*.log",
        ".env"
    ]);
};
const copyDirectory = async (src, dest, excludePatterns = []) => {
    if (!fs.existsSync(src)) {
        return;
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        // Verifica se deve ser excluído
        const shouldExclude = excludePatterns.some((pattern) => {
            if (pattern.includes("*")) {
                const regex = new RegExp(pattern.replace("*", ".*"));
                return regex.test(item);
            }
            return item === pattern;
        });
        if (shouldExclude) {
            continue;
        }
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            await copyDirectory(srcPath, destPath, excludePatterns);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};
const createZip = async (sourceDir, zipPath) => {
    return new Promise((resolve, reject) => {
        try {
            // Verifica se o diretório fonte existe
            if (!fs.existsSync(sourceDir)) {
                reject(new Error(`Diretório fonte não existe: ${sourceDir}`));
                return;
            }
            const output = (0, fs_1.createWriteStream)(zipPath);
            const archive = (0, archiver_1.default)("zip", {
                zlib: { level: 9 }
            });
            let hasError = false;
            output.on("error", (err) => {
                if (!hasError) {
                    hasError = true;
                    logger_1.logger.error(`Erro ao escrever arquivo ZIP: ${err.message}`);
                    reject(new Error(`Erro ao escrever arquivo ZIP: ${err.message}`));
                }
            });
            output.on("close", () => {
                if (!hasError) {
                    const fileSize = archive.pointer();
                    logger_1.logger.info(`Arquivo ZIP criado: ${zipPath} (${fileSize} bytes)`);
                    // Verifica se o arquivo foi criado e tem tamanho
                    if (fs.existsSync(zipPath)) {
                        const stats = fs.statSync(zipPath);
                        if (stats.size === 0) {
                            reject(new Error("Arquivo ZIP criado está vazio"));
                            return;
                        }
                    }
                    resolve();
                }
            });
            archive.on("error", (err) => {
                if (!hasError) {
                    hasError = true;
                    logger_1.logger.error(`Erro ao comprimir arquivos: ${err.message}`);
                    reject(new Error(`Erro ao comprimir arquivos: ${err.message}`));
                }
            });
            archive.on("warning", (err) => {
                if (err.code === "ENOENT") {
                    logger_1.logger.warn(`Aviso ao comprimir: ${err.message}`);
                }
                else {
                    logger_1.logger.warn(`Aviso do archiver: ${err.message}`);
                }
            });
            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        }
        catch (error) {
            reject(new Error(`Erro ao iniciar compressão: ${error.message}`));
        }
    });
};
exports.default = CreateBackupService;
