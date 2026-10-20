"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupEncryptionService = void 0;
const logger_1 = require("../../utils/logger");
class GroupEncryptionService {
    constructor() {
        this.retryAttempts = new Map();
        this.MAX_RETRIES = 3;
    }
    static getInstance() {
        if (!GroupEncryptionService.instance) {
            GroupEncryptionService.instance = new GroupEncryptionService();
        }
        return GroupEncryptionService.instance;
    }
    /**
     * Trata erros de criptografia de grupos
     */
    async handleGroupEncryptionError(error, groupJid, wbot) {
        const errorMessage = error?.message || "";
        // Verificar se é erro de chave privada
        if (errorMessage.includes("Incorrect private key length: 0")) {
            logger_1.logger.warn(`Erro de chave privada para grupo ${groupJid}: ${errorMessage}`);
            // Tentar regenerar chaves para o grupo
            return await this.regenerateGroupKeys(groupJid, wbot);
        }
        // Verificar se é erro de criptografia geral
        if (errorMessage.includes("GroupCipher") || errorMessage.includes("SenderKeyMessage")) {
            logger_1.logger.warn(`Erro de criptografia para grupo ${groupJid}: ${errorMessage}`);
            // Tentar limpar cache e regenerar
            return await this.clearGroupCacheAndRetry(groupJid, wbot);
        }
        return false;
    }
    /**
     * Regenera chaves para um grupo específico
     */
    async regenerateGroupKeys(groupJid, wbot) {
        try {
            const retryKey = `group_${groupJid}`;
            const attempts = this.retryAttempts.get(retryKey) || 0;
            if (attempts >= this.MAX_RETRIES) {
                logger_1.logger.error(`Máximo de tentativas atingido para regenerar chaves do grupo ${groupJid}`);
                this.retryAttempts.delete(retryKey);
                return false;
            }
            this.retryAttempts.set(retryKey, attempts + 1);
            logger_1.logger.info(`Tentativa ${attempts + 1} de regenerar chaves para grupo ${groupJid}`);
            // Tentar obter metadados do grupo para forçar regeneração de chaves
            try {
                await wbot.groupMetadata(groupJid);
                logger_1.logger.info(`Metadados do grupo ${groupJid} obtidos com sucesso`);
            }
            catch (metadataError) {
                logger_1.logger.warn(`Erro ao obter metadados do grupo ${groupJid}:`, metadataError);
            }
            // Aguardar um pouco antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Erro ao regenerar chaves para grupo ${groupJid}:`, error);
            return false;
        }
    }
    /**
     * Limpa cache do grupo e tenta novamente
     */
    async clearGroupCacheAndRetry(groupJid, wbot) {
        try {
            logger_1.logger.info(`Limpando cache para grupo ${groupJid}`);
            // Limpar cache de metadados do grupo se existir
            if (wbot.groupCache) {
                wbot.groupCache.del(groupJid);
            }
            // Aguardar um pouco
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Erro ao limpar cache do grupo ${groupJid}:`, error);
            return false;
        }
    }
    /**
     * Limpa tentativas de retry para um grupo
     */
    clearRetryAttempts(groupJid) {
        const retryKey = `group_${groupJid}`;
        this.retryAttempts.delete(retryKey);
    }
    /**
     * Limpa todas as tentativas de retry
     */
    clearAllRetryAttempts() {
        this.retryAttempts.clear();
    }
}
exports.GroupEncryptionService = GroupEncryptionService;
exports.default = GroupEncryptionService.getInstance();
