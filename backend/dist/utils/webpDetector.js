"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnimatedWebPFromBuffer = exports.isAnimatedWebP = void 0;
const fs_1 = __importDefault(require("fs"));
const webpinfo_1 = require("webpinfo");
/**
 * Detecta se um arquivo WebP é animado
 * @param filePath Caminho completo do arquivo
 * @returns true se o WebP for animado, false caso contrário
 */
const isAnimatedWebP = async (filePath) => {
    try {
        // Verificar se o arquivo existe
        if (!fs_1.default.existsSync(filePath)) {
            return false;
        }
        // Ler os primeiros bytes do arquivo para verificar se é WebP
        const buffer = fs_1.default.readFileSync(filePath);
        // Verificar se começa com o header WebP: RIFF....WEBP
        if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
            return false;
        }
        const webpHeader = buffer.toString('ascii', 8, 12);
        if (webpHeader !== 'WEBP') {
            return false;
        }
        // Verificar se tem o chunk ANIM ou ANMF (indicam animação)
        try {
            // Usar WebPInfo.from() e verificar summary.isAnimated (método compatível com tipos TypeScript)
            const webpInfo = await webpinfo_1.WebPInfo.from(buffer);
            return webpInfo.summary.isAnimated || false;
        }
        catch (err) {
            // Se webpinfo falhar, verificar manualmente por chunks ANIM/ANMF
            const bufferString = buffer.toString('binary');
            // Procurar por "ANIM" ou "ANMF" no buffer
            if (bufferString.includes('ANIM') || bufferString.includes('ANMF')) {
                return true;
            }
            return false;
        }
    }
    catch (error) {
        console.error("Erro ao detectar WebP animado:", error);
        return false;
    }
};
exports.isAnimatedWebP = isAnimatedWebP;
/**
 * Detecta se um buffer de dados WebP é animado
 * @param buffer Buffer de dados do arquivo
 * @returns true se o WebP for animado, false caso contrário
 */
const isAnimatedWebPFromBuffer = async (buffer) => {
    try {
        // Verificar se começa com o header WebP
        if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
            return false;
        }
        const webpHeader = buffer.toString('ascii', 8, 12);
        if (webpHeader !== 'WEBP') {
            return false;
        }
        // Verificar se tem o chunk ANIM ou ANMF
        try {
            // Usar WebPInfo.from() e verificar summary.isAnimated (método compatível com tipos TypeScript)
            const webpInfo = await webpinfo_1.WebPInfo.from(buffer);
            return webpInfo.summary.isAnimated || false;
        }
        catch (err) {
            // Se webpinfo falhar, verificar manualmente por chunks ANIM/ANMF
            const bufferString = buffer.toString('binary');
            if (bufferString.includes('ANIM') || bufferString.includes('ANMF')) {
                return true;
            }
            return false;
        }
    }
    catch (error) {
        console.error("Erro ao detectar WebP animado do buffer:", error);
        return false;
    }
};
exports.isAnimatedWebPFromBuffer = isAnimatedWebPFromBuffer;
