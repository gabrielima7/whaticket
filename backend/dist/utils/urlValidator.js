"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSafeExternalUrl = exports.isPrivateOrReservedIPv6 = exports.isPrivateOrReservedIPv4 = void 0;
const dns_1 = __importDefault(require("dns"));
const net_1 = __importDefault(require("net"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const logger_1 = require("./logger");
/**
 * Verifica se um IPv4 pertence a intervalos reservados / privados / loopback
 */
const isPrivateOrReservedIPv4 = (ip) => {
    const parts = ip.split(".").map(part => parseInt(part, 10));
    if (parts.length !== 4 || parts.some(isNaN)) {
        return true; // Se o IP for malformado, bloqueia por padrão
    }
    const [o1, o2, o3] = parts;
    // 0.0.0.0/8 (Rede atual)
    if (o1 === 0)
        return true;
    // 10.0.0.0/8 (Rede privada RFC 1918)
    if (o1 === 10)
        return true;
    // 127.0.0.0/8 (Loopback / Localhost)
    if (o1 === 127)
        return true;
    // 169.254.0.0/16 (Link-Local / AWS/GCP/Azure Metadata 169.254.169.254)
    if (o1 === 169 && o2 === 254)
        return true;
    // 172.16.0.0/12 (Rede privada RFC 1918: 172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31)
        return true;
    // 192.168.0.0/16 (Rede privada RFC 1918)
    if (o1 === 192 && o2 === 168)
        return true;
    // 100.64.0.0/10 (Carrier-Grade NAT / Shared Address Space)
    if (o1 === 100 && o2 >= 64 && o2 <= 127)
        return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentação / Testes)
    if (o1 === 192 && o2 === 0 && o3 === 2)
        return true;
    if (o1 === 198 && o2 === 51 && o3 === 100)
        return true;
    if (o1 === 203 && o2 === 0 && o3 === 113)
        return true;
    // 224.0.0.0/4 (Multicast e reservado: >= 224)
    if (o1 >= 224)
        return true;
    return false;
};
exports.isPrivateOrReservedIPv4 = isPrivateOrReservedIPv4;
/**
 * Verifica se um IPv6 pertence a intervalos reservados / privados / loopback
 */
const isPrivateOrReservedIPv6 = (ip) => {
    const normalized = ip.toLowerCase();
    // Loopback ::1
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1")
        return true;
    // Não especificado ::
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0")
        return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    if (normalized.startsWith("::ffff:")) {
        const ipv4Part = normalized.replace("::ffff:", "");
        if (net_1.default.isIPv4(ipv4Part)) {
            return (0, exports.isPrivateOrReservedIPv4)(ipv4Part);
        }
        return true;
    }
    // Unique Local Address fc00::/7 (fc00:: a fdff::)
    if (normalized.startsWith("fc") || normalized.startsWith("fd"))
        return true;
    // Link-Local fe80::/10 (fe80:: a febf::)
    if (normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb")) {
        return true;
    }
    return false;
};
exports.isPrivateOrReservedIPv6 = isPrivateOrReservedIPv6;
/**
 * Validador SSRF: analisa a URL e garante que ela não aponte para localhost, redes privadas RFC1918 ou metadados de nuvem.
 */
const assertSafeExternalUrl = async (inputUrl) => {
    if (!inputUrl || typeof inputUrl !== "string") {
        throw new AppError_1.default("URL não informada ou inválida.", 400);
    }
    let parsed;
    try {
        parsed = new URL(inputUrl.trim());
    }
    catch (err) {
        throw new AppError_1.default("Formato de URL inválido.", 400);
    }
    // Permitir apenas http e https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new AppError_1.default(`Protocolo não permitido: ${parsed.protocol}. Apenas HTTP e HTTPS são suportados.`, 400);
    }
    const hostname = parsed.hostname.toLowerCase().trim();
    if (!hostname) {
        throw new AppError_1.default("Hostname inválido na URL.", 400);
    }
    // Bloquear nomes explícitos de loopback / local
    if (hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")) {
        logger_1.logger.warn(`SSRF bloqueado: tentativa de acesso ao hostname local '${hostname}'`);
        throw new AppError_1.default("Requisições para hosts locais ou internos são proibidas.", 400);
    }
    // Verificar se o hostname é um IP literal
    if (net_1.default.isIP(hostname)) {
        if (net_1.default.isIPv4(hostname) && (0, exports.isPrivateOrReservedIPv4)(hostname)) {
            logger_1.logger.warn(`SSRF bloqueado: tentativa de acesso a IP IPv4 privado '${hostname}'`);
            throw new AppError_1.default("Requisições para redes locais ou privadas (IPv4) são proibidas.", 400);
        }
        if (net_1.default.isIPv6(hostname) && (0, exports.isPrivateOrReservedIPv6)(hostname)) {
            logger_1.logger.warn(`SSRF bloqueado: tentativa de acesso a IP IPv6 privado '${hostname}'`);
            throw new AppError_1.default("Requisições para redes locais ou privadas (IPv6) são proibidas.", 400);
        }
        return parsed;
    }
    // Resolução DNS para detectar DNS Rebinding ou domínios apontando para IPs privados
    try {
        const addresses = await dns_1.default.promises.lookup(hostname, { all: true });
        for (const record of addresses) {
            if (record.family === 4 && (0, exports.isPrivateOrReservedIPv4)(record.address)) {
                logger_1.logger.warn(`SSRF bloqueado: domínio '${hostname}' resolveu para IPv4 privado '${record.address}'`);
                throw new AppError_1.default(`Requisições para redes locais ou privadas são proibidas (resolvido para ${record.address}).`, 400);
            }
            if (record.family === 6 && (0, exports.isPrivateOrReservedIPv6)(record.address)) {
                logger_1.logger.warn(`SSRF bloqueado: domínio '${hostname}' resolveu para IPv6 privado '${record.address}'`);
                throw new AppError_1.default(`Requisições para redes locais ou privadas são proibidas (resolvido para ${record.address}).`, 400);
            }
        }
    }
    catch (dnsErr) {
        if (dnsErr instanceof AppError_1.default) {
            throw dnsErr;
        }
        logger_1.logger.warn(`Falha na resolução DNS do hostname '${hostname}': ${dnsErr?.message}`);
        throw new AppError_1.default(`Não foi possível resolver o endereço de '${hostname}'.`, 400);
    }
    return parsed;
};
exports.assertSafeExternalUrl = assertSafeExternalUrl;
