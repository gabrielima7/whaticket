"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersionByIndexFromUrl = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Função que faz GET na URL e busca qualquer posição do array
 * Retorna no formato [major, minor, patch] para WAVersion
 */
async function getVersionByIndexFromUrl(index = 2) {
    try {
        const url = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json';
        const response = await axios_1.default.get(url);
        const versionsData = response.data;
        if (!versionsData.versions || versionsData.versions.length <= index) {
            throw new Error(`Array versions deve ter pelo menos ${index + 1} itens`);
        }
        const versionItem = versionsData.versions[index];
        if (!versionItem || !versionItem.version) {
            throw new Error(`Item na posição ${index} não encontrado ou sem versão válida`);
        }
        // Remove o sufixo -alpha
        const versionWithoutAlpha = versionItem.version.replace('-alpha', '');
        // Converte para array de números
        const [major, minor, patch] = versionWithoutAlpha.split('.').map(Number);
        return [major, minor, patch];
    }
    catch (error) {
        console.error('Erro ao buscar versão da URL:', error);
        throw error;
    }
}
exports.getVersionByIndexFromUrl = getVersionByIndexFromUrl;
