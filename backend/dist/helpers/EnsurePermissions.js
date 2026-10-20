"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixPermissionsRecursively = exports.ensureCompanyFolderPermissions = exports.ensureFilePermissions = exports.ensureFolderPermissions = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
/**
 * Garante que uma pasta tenha permissões 777
 * Cria a pasta se não existir
 *
 * @param folderPath - Caminho completo da pasta
 * @returns true se as permissões foram aplicadas com sucesso
 */
const ensureFolderPermissions = (folderPath) => {
    try {
        // Criar pasta se não existir
        if (!fs_1.default.existsSync(folderPath)) {
            fs_1.default.mkdirSync(folderPath, { recursive: true, mode: 0o777 });
            logger_1.logger.info(`📁 Pasta criada com permissões 777: ${folderPath}`);
            return true;
        }
        // Aplicar permissões 777
        fs_1.default.chmodSync(folderPath, 0o777);
        return true;
    }
    catch (error) {
        logger_1.logger.warn(`⚠️ Não foi possível garantir permissões em: ${folderPath}`, error);
        return false;
    }
};
exports.ensureFolderPermissions = ensureFolderPermissions;
/**
 * Garante que um arquivo tenha permissões 777
 *
 * @param filePath - Caminho completo do arquivo
 * @returns true se as permissões foram aplicadas com sucesso
 */
const ensureFilePermissions = (filePath) => {
    try {
        if (!fs_1.default.existsSync(filePath)) {
            logger_1.logger.warn(`⚠️ Arquivo não existe: ${filePath}`);
            return false;
        }
        fs_1.default.chmodSync(filePath, 0o777);
        return true;
    }
    catch (error) {
        logger_1.logger.warn(`⚠️ Não foi possível alterar permissões do arquivo: ${filePath}`, error);
        return false;
    }
};
exports.ensureFilePermissions = ensureFilePermissions;
/**
 * Garante permissões da pasta de uma company específica
 * Cria a estrutura de pastas se necessário
 *
 * @param companyId - ID da company
 * @param subFolder - Subpasta opcional (ex: "stickers", "quick")
 * @returns Caminho completo da pasta
 */
const ensureCompanyFolderPermissions = (companyId, subFolder) => {
    const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
    const companyFolder = path_1.default.join(publicFolder, `company${companyId}`);
    // Garantir permissões da pasta da company
    (0, exports.ensureFolderPermissions)(companyFolder);
    // Se há subpasta, garantir permissões dela também
    if (subFolder) {
        const fullPath = path_1.default.join(companyFolder, subFolder);
        (0, exports.ensureFolderPermissions)(fullPath);
        return fullPath;
    }
    return companyFolder;
};
exports.ensureCompanyFolderPermissions = ensureCompanyFolderPermissions;
/**
 * Corrige permissões de uma pasta recursivamente
 * Útil para corrigir pastas antigas que não têm as permissões corretas
 *
 * @param folderPath - Caminho da pasta
 */
const fixPermissionsRecursively = (folderPath) => {
    try {
        if (!fs_1.default.existsSync(folderPath)) {
            logger_1.logger.warn(`⚠️ Pasta não existe: ${folderPath}`);
            return;
        }
        // Corrigir permissões da pasta principal
        (0, exports.ensureFolderPermissions)(folderPath);
        // Ler itens da pasta
        const items = fs_1.default.readdirSync(folderPath);
        items.forEach(item => {
            const itemPath = path_1.default.join(folderPath, item);
            const stats = fs_1.default.statSync(itemPath);
            if (stats.isDirectory()) {
                // Recursivamente corrigir subpastas
                (0, exports.fixPermissionsRecursively)(itemPath);
            }
            else {
                // Corrigir permissões do arquivo
                (0, exports.ensureFilePermissions)(itemPath);
            }
        });
        logger_1.logger.info(`✅ Permissões corrigidas recursivamente: ${folderPath}`);
    }
    catch (error) {
        logger_1.logger.error(`❌ Erro ao corrigir permissões recursivamente: ${folderPath}`, error);
    }
};
exports.fixPermissionsRecursively = fixPermissionsRecursively;
exports.default = {
    ensureFolderPermissions: exports.ensureFolderPermissions,
    ensureFilePermissions: exports.ensureFilePermissions,
    ensureCompanyFolderPermissions: exports.ensureCompanyFolderPermissions,
    fixPermissionsRecursively: exports.fixPermissionsRecursively
};
