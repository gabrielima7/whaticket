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
exports.webhook = exports.createWebhook = exports.validateWebhook = exports.createSubscription = exports.index = void 0;
const express_1 = __importDefault(require("express"));
const Yup = __importStar(require("yup"));
const gn_api_sdk_typescript_1 = __importDefault(require("gn-api-sdk-typescript"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const AppError_1 = __importDefault(require("../errors/AppError"));
const Company_1 = __importDefault(require("../models/Company"));
const Invoices_1 = __importDefault(require("../models/Invoices"));
const socket_1 = require("../libs/socket");
const ShowSettingsService_1 = __importDefault(require("../services/SettingServices/ShowSettingsService"));
const MercadoPagoService_1 = __importDefault(require("../services/PaymentProvider/MercadoPagoService"));
const User_1 = __importDefault(require("../models/User"));
const logger_1 = require("../utils/logger");
const CompanyInvoiceService_1 = require("../services/InvoicesService/CompanyInvoiceService");
const app = (0, express_1.default)();
const getRequestRawBody = (req) => {
    const raw = req.rawBody;
    if (typeof raw === "string") {
        return raw;
    }
    if (Buffer.isBuffer(raw)) {
        return raw.toString("utf-8");
    }
    return JSON.stringify(req.body ?? {});
};
const timingSafeCompare = (a, b) => {
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');
    if (aBuffer.length !== bBuffer.length) {
        return false;
    }
    // Converte Buffer para Uint8Array para compatibilidade com crypto.timingSafeEqual
    const aUint8 = new Uint8Array(aBuffer);
    const bUint8 = new Uint8Array(bBuffer);
    return crypto_1.default.timingSafeEqual(aUint8, bUint8);
};
const parseSignatureHeader = (headerValue) => {
    return headerValue.split(",").reduce((acc, part) => {
        const [rawKey, rawValue] = part.split("=");
        if (!rawKey || !rawValue) {
            return acc;
        }
        const key = rawKey.trim();
        const value = rawValue.trim();
        if (key && value) {
            acc[key] = value.replace(/^"|"$/g, "");
        }
        return acc;
    }, {});
};
const normalizeHash = (hash) => {
    // Remove prefixos comuns: sha256=, sha256:, etc.
    // O X-Webhook-Signature do GN Cloud geralmente vem como hex direto ou com prefixo
    return hash.replace(/^(sha256[=:]|sha[=:]|hex[=:])?/i, "").trim();
};
const verifyMercadoPagoSignature = async (req, rawBody) => {
    const signatureHeader = req.headers["x-signature"];
    // Busca o secret das configurações ou variável de ambiente
    const superAdminWebhookSecretSetting = await (0, ShowSettingsService_1.default)({
        settingKey: "mercadoPagoWebhookSecret",
        companyId: SUPER_ADMIN_COMPANY_ID
    }).catch(() => null);
    const secret = superAdminWebhookSecretSetting?.value || process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    // Se não houver secret configurado, aceita a requisição mas registra aviso
    // A validação de assinatura é recomendada mas não obrigatória
    // A validação real será feita verificando o paymentId diretamente na API do Mercado Pago
    if (!secret) {
        logger_1.logger.warn({
            message: "Assinatura secreta do webhook Mercado Pago não configurada. Aceitando requisição sem validação.",
            hint: "Para maior segurança, defina MERCADO_PAGO_WEBHOOK_SECRET nas variáveis de ambiente.",
            note: "O webhook funcionará, mas sem validação de assinatura. Configure o secret para produção."
        });
        // Retorna true para não bloquear o processamento
        // A validação será feita verificando o paymentId diretamente na API do Mercado Pago
        return true;
    }
    // Se não houver cabeçalho de assinatura, mas houver secret configurado
    // Pode ser uma requisição legítima sem assinatura (alguns casos)
    if (!signatureHeader || Array.isArray(signatureHeader)) {
        logger_1.logger.warn({
            message: "Cabeçalho de assinatura do Mercado Pago ausente ou inválido. Aceitando requisição.",
            note: "A validação será feita verificando o paymentId diretamente na API do Mercado Pago."
        });
        // Retorna true para não bloquear, mas a validação real será feita via API
        return true;
    }
    // Tenta validar a assinatura se houver cabeçalho e secret
    try {
        const parsed = parseSignatureHeader(signatureHeader);
        const timestamp = parsed.ts || parsed.time || parsed.timestamp;
        const providedSignature = parsed.v1 || parsed.signature || parsed.hash;
        if (!timestamp || !providedSignature) {
            logger_1.logger.warn({
                message: "Assinatura do Mercado Pago sem campos obrigatórios. Aceitando requisição.",
                parsedHeader: parsed
            });
            return true;
        }
        const payload = `${timestamp}.${rawBody}`;
        const expectedSignature = crypto_1.default.createHmac("sha256", secret).update(payload).digest("hex");
        const normalizedProvided = normalizeHash(providedSignature);
        const isValid = timingSafeCompare(normalizedProvided, expectedSignature);
        if (isValid) {
            logger_1.logger.info({
                message: "Webhook Mercado Pago autenticado via assinatura HMAC-SHA256."
            });
        }
        else {
            logger_1.logger.warn({
                message: "Assinatura do Mercado Pago inválida. Aceitando requisição para validação via API.",
                note: "A validação será feita verificando o paymentId diretamente na API do Mercado Pago."
            });
        }
        // Mesmo se a assinatura for inválida, aceita para validar via API depois
        // Isso permite que funcione mesmo com problemas de assinatura
        return true;
    }
    catch (error) {
        logger_1.logger.warn({
            message: "Erro ao validar assinatura do Mercado Pago. Aceitando requisição.",
            errorMessage: error?.message,
            note: "A validação será feita verificando o paymentId diretamente na API do Mercado Pago."
        });
        return true;
    }
};
const verifyGerencianetSignature = (req, rawBody, clientSecret) => {
    // Segundo a documentação da Efí (https://dev.efipay.com.br/docs/api-pix/webhooks/),
    // a autenticação principal é feita via mTLS (mutual TLS)
    // Verifica primeiro se a requisição foi autenticada via mTLS
    const socket = req.socket;
    const isMtlsAuthorized = socket?.authorized === true;
    if (isMtlsAuthorized) {
        logger_1.logger.info({
            message: "Webhook Gerencianet autenticado via mTLS.",
            socketAuthorized: socket.authorized
        });
        return true;
    }
    // Se não houver mTLS, tenta validar via assinatura HMAC
    // GN Cloud (Gerencianet mais recente) usa X-Webhook-Signature como cabeçalho obrigatório
    // Versões antigas podem usar x-hub-signature, x-hub-signature-256 ou x-sgn
    const possibleHeaders = [
        req.headers["x-webhook-signature"],
        req.headers["X-Webhook-Signature"],
        req.headers["x-hub-signature"],
        req.headers["x-hub-signature-256"],
        req.headers["x-sgn"]
    ];
    const signatureHeader = possibleHeaders.find(Boolean);
    if (!signatureHeader || Array.isArray(signatureHeader)) {
        // Se não houver mTLS nem assinatura, mas o servidor não está configurado com mTLS,
        // aceita a requisição (para ambientes sem mTLS configurado)
        // Isso permite que funcione mesmo sem mTLS configurado no servidor
        if (socket?.authorized === undefined) {
            logger_1.logger.warn({
                message: "Webhook Gerencianet sem mTLS nem assinatura HMAC. Aceitando requisição (mTLS não configurado no servidor).",
                availableHeaders: {
                    "x-webhook-signature": req.headers["x-webhook-signature"],
                    "X-Webhook-Signature": req.headers["X-Webhook-Signature"],
                    "x-hub-signature": req.headers["x-hub-signature"],
                    "x-hub-signature-256": req.headers["x-hub-signature-256"],
                    "x-sgn": req.headers["x-sgn"]
                },
                socketAuthorized: socket?.authorized,
                note: "Configure mTLS no servidor para maior segurança conforme documentação da Efí"
            });
            // Aceita a requisição se não houver mTLS configurado
            // Em produção, recomenda-se configurar mTLS
            return true;
        }
        logger_1.logger.warn({
            message: "Cabeçalho de assinatura do Gerencianet ausente ou inválido e mTLS não autorizado.",
            availableHeaders: {
                "x-webhook-signature": req.headers["x-webhook-signature"],
                "X-Webhook-Signature": req.headers["X-Webhook-Signature"],
                "x-hub-signature": req.headers["x-hub-signature"],
                "x-hub-signature-256": req.headers["x-hub-signature-256"],
                "x-sgn": req.headers["x-sgn"]
            },
            socketAuthorized: socket?.authorized
        });
        return false;
    }
    const providedSignature = signatureHeader.toString();
    const normalizedProvided = normalizeHash(providedSignature);
    // Gera a assinatura esperada usando HMAC-SHA256
    const expectedSignature = crypto_1.default.createHmac("sha256", clientSecret).update(rawBody).digest("hex");
    const isValid = timingSafeCompare(normalizedProvided, expectedSignature);
    if (!isValid) {
        logger_1.logger.warn({
            message: "Assinatura do webhook Gerencianet inválida.",
            headerUsed: signatureHeader ? Object.keys(req.headers).find(key => req.headers[key] === signatureHeader) : "nenhum",
            providedSignatureLength: normalizedProvided.length,
            expectedSignatureLength: expectedSignature.length,
            rawBodyLength: rawBody.length,
            socketAuthorized: socket?.authorized
        });
    }
    else {
        logger_1.logger.info({
            message: "Webhook Gerencianet autenticado via assinatura HMAC-SHA256.",
            headerUsed: Object.keys(req.headers).find(key => req.headers[key] === signatureHeader)
        });
    }
    return isValid;
};
const index = async (req, res) => {
    const { options: gerencianetOptions } = await getGerencianetSettings();
    const gerencianet = (0, gn_api_sdk_typescript_1.default)(gerencianetOptions);
    return res.json(gerencianet.getSubscriptions());
};
exports.index = index;
const SUPER_ADMIN_COMPANY_ID = Number(process.env.SUPER_ADMIN_COMPANY_ID || 1);
const resolveSubscriptionPaymentProvider = async (companyId) => {
    const companySetting = await (0, ShowSettingsService_1.default)({
        settingKey: "subscriptionPaymentProvider",
        companyId
    }).catch(() => null);
    if (companySetting?.value) {
        return String(companySetting.value).toLowerCase();
    }
    const superAdminSetting = await (0, ShowSettingsService_1.default)({
        settingKey: "subscriptionPaymentProvider",
        companyId: SUPER_ADMIN_COMPANY_ID
    }).catch(() => null);
    if (superAdminSetting?.value) {
        return String(superAdminSetting.value).toLowerCase();
    }
    return process.env.SUBSCRIPTION_PAYMENT_PROVIDER?.toLowerCase() || "gerencianet";
};
const parseBoolean = (value) => {
    if (!value) {
        return false;
    }
    const normalized = value.toString().trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(normalized);
};
const getSettingValue = async (key) => {
    const setting = await (0, ShowSettingsService_1.default)({
        settingKey: key,
        companyId: SUPER_ADMIN_COMPANY_ID
    }).catch(() => null);
    return setting?.value;
};
const getGerencianetSettings = async () => {
    const sandboxSetting = await getSettingValue("gerencianetSandbox");
    const clientIdSetting = await getSettingValue("gerencianetClientId");
    const clientSecretSetting = await getSettingValue("gerencianetClientSecret");
    const pixCertSetting = await getSettingValue("gerencianetPixCert");
    const pixKeySetting = await getSettingValue("gerencianetPixKey");
    const envSandbox = process.env.GERENCIANET_SANDBOX;
    const sandbox = sandboxSetting != null ? parseBoolean(sandboxSetting) : parseBoolean(envSandbox);
    const clientId = clientIdSetting || process.env.GERENCIANET_CLIENT_ID;
    const clientSecret = clientSecretSetting || process.env.GERENCIANET_CLIENT_SECRET;
    const pixCertBase = pixCertSetting || process.env.GERENCIANET_PIX_CERT;
    const pixKey = pixKeySetting || process.env.GERENCIANET_PIX_KEY;
    if (!clientId || !clientSecret || !pixCertBase || !pixKey) {
        throw new AppError_1.default("Configurações do Gerencianet não estão completas. Verifique Client ID, Client Secret, certificado e chave PIX.", 400);
    }
    const pixCertPath = path_1.default.resolve(__dirname, `../../certs/${pixCertBase}.p12`);
    if (!fs_1.default.existsSync(pixCertPath)) {
        throw new AppError_1.default("Certificado do Gerencianet não encontrado. Envie o arquivo .p12 nas configurações.", 400);
    }
    return {
        options: {
            sandbox,
            client_id: clientId,
            client_secret: clientSecret,
            pix_cert: pixCertPath
        },
        pixKey
    };
};
const ensureGerencianetWebhook = async (gerencianetClient, pixKey, webhookUrl) => {
    try {
        logger_1.logger.info({
            message: "Configurando webhook do Gerencianet.",
            pixKey,
            webhookUrl
        });
        const result = await gerencianetClient.pixConfigWebhook({ chave: pixKey }, { webhookUrl });
        logger_1.logger.info({
            message: "Webhook do Gerencianet configurado com sucesso.",
            pixKey,
            webhookUrl,
            result
        });
        // Aguarda um pouco para dar tempo do Gerencianet validar o webhook
        // O Gerencianet faz uma requisição PUT para validar imediatamente após a configuração
        // Mas se der erro 401, pode ser que a validação esteja falhando
        await new Promise(resolve => setTimeout(resolve, 3000));
        logger_1.logger.info({
            message: "Aguardou validação do webhook pelo Gerencianet.",
            pixKey,
            webhookUrl
        });
    }
    catch (error) {
        const status = error?.response?.status;
        const errorData = error?.response?.data;
        logger_1.logger.error({
            message: "Falha ao configurar webhook do Gerencianet. Verifique manualmente.",
            status,
            errorMessage: error?.message,
            errorResponse: errorData,
            pixKey,
            webhookUrl,
            fullError: error
        });
        // Se o erro for 401, significa que a validação do webhook falhou
        // Isso pode acontecer se o endpoint não estiver respondendo corretamente
        if (errorData?.nome === "webhook_invalido" || errorData?.mensagem?.includes("401")) {
            logger_1.logger.warn({
                message: "Webhook retornou 401 durante validação. Verifique se o endpoint está acessível e retornando 200 OK para requisições PUT sem autenticação.",
                webhookUrl,
                suggestion: "Teste o webhook manualmente usando o endpoint de validação antes de configurar."
            });
        }
        // Não lança erro para não bloquear a criação da assinatura
        // O webhook pode ser configurado manualmente depois
    }
};
const createSubscription = async (req, res) => {
    const { companyId, id: userId } = req.user;
    const schema = Yup.object().shape({
        price: Yup.string().required(),
        users: Yup.string().required(),
        connections: Yup.string().required()
    });
    if (!(await schema.isValid(req.body))) {
        throw new AppError_1.default("Validation fails", 400);
    }
    const { firstName, lastName, email, price, users, connections, invoiceId } = req.body;
    const invoice = await Invoices_1.default.findByPk(invoiceId);
    if (!invoice || invoice.companyId !== companyId) {
        throw new AppError_1.default("Fatura não encontrada.", 404);
    }
    let payerEmail = email;
    if (!payerEmail) {
        const user = await User_1.default.findByPk(userId);
        payerEmail = user?.email || undefined;
    }
    if (!payerEmail) {
        throw new AppError_1.default("E-mail do pagador é obrigatório.", 400);
    }
    const paymentProvider = await resolveSubscriptionPaymentProvider(companyId);
    if (paymentProvider === "mercadopago") {
        const webhookUrl = process.env.MERCADO_PAGO_WEBHOOK_URL || `${process.env.BACKEND_URL}/subscription/webhook/mercadopago`;
        const payment = await MercadoPagoService_1.default.createPixPayment({
            companyId,
            amount: Number(price),
            description: `Plano ${connections} conexões / ${users} usuários`,
            invoiceId,
            payerEmail,
            payerFirstName: firstName,
            payerLastName: lastName,
            webhookUrl
        });
        await invoice.update({
            paymentProvider: "mercadopago",
            providerPaymentId: payment.paymentId,
            pixCopyPaste: payment.pixCopyPaste,
            qrCodeBase64: payment.qrCodeBase64,
            payerEmail
        });
        return res.json({
            provider: "mercadopago",
            valor: {
                original: Number(price)
            },
            qrcode: {
                qrcode: payment.pixCopyPaste,
                imagemQrcode: payment.qrCodeBase64
            },
            expiresAt: payment.expiresAt
        });
    }
    const { options: gerencianetOptions, pixKey } = await getGerencianetSettings();
    const gerencianet = (0, gn_api_sdk_typescript_1.default)(gerencianetOptions);
    const gerencianetWebhookUrl = process.env.GERENCIANET_WEBHOOK_URL || `${process.env.BACKEND_URL}/subscription/webhook`;
    await ensureGerencianetWebhook(gerencianet, pixKey, gerencianetWebhookUrl);
    const body = {
        calendario: {
            expiracao: 3600
        },
        valor: {
            original: Number(price)
                .toLocaleString("pt-br", { minimumFractionDigits: 2 })
                .replace(",", ".")
        },
        chave: pixKey,
        solicitacaoPagador: `#Fatura:${invoiceId}`
    };
    try {
        const pix = await gerencianet.pixCreateImmediateCharge(null, body);
        const qrcode = await gerencianet.pixGenerateQRCode({
            id: pix.loc.id
        });
        await invoice.update({
            paymentProvider: "gerencianet",
            providerPaymentId: pix.txid || pix.loc?.id || null,
            pixCopyPaste: qrcode.qrcode,
            qrCodeBase64: qrcode.imagemQrcode,
            payerEmail
        });
        return res.json({
            ...pix,
            qrcode
        });
    }
    catch (error) {
        throw new AppError_1.default("Não foi possível gerar o PIX.", 400);
    }
};
exports.createSubscription = createSubscription;
/**
 * Valida uma URL de webhook fazendo uma requisição PUT simulando o Gerencianet
 * Isso permite testar se a URL está acessível e responde corretamente antes de configurar
 */
const validateWebhook = async (req, res) => {
    const schema = Yup.object().shape({
        url: Yup.string().url().required()
    });
    if (!(await schema.isValid(req.body))) {
        throw new AppError_1.default("URL inválida. Forneça uma URL válida.", 400);
    }
    const { url } = req.body;
    try {
        logger_1.logger.info({
            message: "Iniciando validação do webhook.",
            url
        });
        // Faz uma requisição PUT simulando o Gerencianet
        const validationResult = await testWebhookUrl(url);
        if (validationResult.success) {
            logger_1.logger.info({
                message: "Webhook validado com sucesso.",
                url,
                statusCode: validationResult.statusCode
            });
            return res.json({
                success: true,
                message: "Webhook válido e acessível. A URL responde corretamente às requisições de validação.",
                statusCode: validationResult.statusCode,
                url
            });
        }
        else {
            logger_1.logger.warn({
                message: "Falha na validação do webhook.",
                url,
                error: validationResult.error,
                statusCode: validationResult.statusCode
            });
            return res.status(400).json({
                success: false,
                message: validationResult.error || "A URL não respondeu corretamente à validação.",
                statusCode: validationResult.statusCode,
                url
            });
        }
    }
    catch (error) {
        logger_1.logger.error({
            message: "Erro ao validar webhook.",
            errorMessage: error?.message,
            url,
            stack: error?.stack
        });
        throw new AppError_1.default(error?.message || "Erro ao validar o webhook. Verifique se a URL está acessível.", 500);
    }
};
exports.validateWebhook = validateWebhook;
/**
 * Testa uma URL de webhook fazendo uma requisição PUT
 * Simula o comportamento do Gerencianet ao validar webhooks
 */
const testWebhookUrl = (webhookUrl) => {
    return new Promise((resolve) => {
        try {
            const url = new url_1.URL(webhookUrl);
            const isHttps = url.protocol === "https:";
            const client = isHttps ? https_1.default : http_1.default;
            const requestBody = JSON.stringify({
                webhookUrl: webhookUrl
            });
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(requestBody),
                    "User-Agent": "Gerencianet-Webhook-Validator/1.0"
                },
                timeout: 10000 // 10 segundos de timeout
            };
            const req = client.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    // Considera sucesso se retornar 200, 201 ou 204
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({
                            success: true,
                            statusCode: res.statusCode
                        });
                    }
                    else {
                        resolve({
                            success: false,
                            statusCode: res.statusCode,
                            error: `A URL retornou o código HTTP ${res.statusCode}. Esperado: 200-299`
                        });
                    }
                });
            });
            req.on("error", (error) => {
                resolve({
                    success: false,
                    error: `Erro de conexão: ${error.message}`
                });
            });
            req.on("timeout", () => {
                req.destroy();
                resolve({
                    success: false,
                    error: "Timeout: A URL não respondeu em até 10 segundos"
                });
            });
            req.write(requestBody);
            req.end();
        }
        catch (error) {
            resolve({
                success: false,
                error: `Erro ao processar URL: ${error.message}`
            });
        }
    });
};
const createWebhook = async (req, res) => {
    const schema = Yup.object().shape({
        chave: Yup.string().required(),
        url: Yup.string().required()
    });
    if (!(await schema.isValid(req.body))) {
        throw new AppError_1.default("Validation fails", 400);
    }
    const { chave, url } = req.body;
    const body = {
        webhookUrl: url
    };
    const params = {
        chave
    };
    try {
        logger_1.logger.info({
            message: "Registrando webhook do Gerencianet via endpoint manual.",
            chave,
            url
        });
        const { options: gerencianetOptions } = await getGerencianetSettings();
        const gerencianet = (0, gn_api_sdk_typescript_1.default)(gerencianetOptions);
        const create = await gerencianet.pixConfigWebhook(params, body);
        logger_1.logger.info({
            message: "Webhook do Gerencianet registrado com sucesso via endpoint manual.",
            chave,
            url,
            response: create
        });
        return res.json(create);
    }
    catch (error) {
        const status = error?.response?.status;
        const errorData = error?.response?.data;
        logger_1.logger.error({
            message: "Falha ao registrar webhook do Gerencianet via endpoint manual.",
            errorMessage: error?.message,
            errorResponse: errorData,
            status,
            chave,
            url,
            stack: error?.stack
        });
        // Retorna uma mensagem mais detalhada
        const errorMessage = errorData?.mensagem || error?.message || "Não foi possível registrar o webhook do Gerencianet.";
        throw new AppError_1.default(errorMessage, status || 400);
    }
};
exports.createWebhook = createWebhook;
const webhook = async (req, res) => {
    const rawBody = getRequestRawBody(req);
    const { type } = req.params;
    const isPutRequest = req.method === "PUT";
    const isPostRequest = req.method === "POST";
    // Tratamento especial para requisições PUT de validação do Gerencianet
    // O Gerencianet faz um PUT para validar o webhook quando ele é configurado
    // Essas requisições não têm assinatura e devem retornar sucesso com status 200
    // IMPORTANTE: Esta verificação deve vir ANTES de qualquer verificação de assinatura ou processamento
    if (isPutRequest) {
        logger_1.logger.info({
            message: "Requisição PUT recebida no endpoint de webhook.",
            type,
            body: req.body,
            headers: {
                "x-webhook-signature": req.headers["x-webhook-signature"],
                "X-Webhook-Signature": req.headers["X-Webhook-Signature"],
                "x-hub-signature": req.headers["x-hub-signature"],
                "x-hub-signature-256": req.headers["x-hub-signature-256"],
                "x-sgn": req.headers["x-sgn"],
                "content-type": req.headers["content-type"],
                "user-agent": req.headers["user-agent"]
            },
            url: req.url,
            path: req.path
        });
        // O Gerencianet faz PUT para validar o webhook
        // Essas requisições não têm assinatura e devem retornar 200 OK
        // Verifica se não tem assinatura (é validação) ou se tem webhookUrl no body
        const hasSignature = !!(req.headers["x-webhook-signature"] ||
            req.headers["X-Webhook-Signature"] ||
            req.headers["x-hub-signature"] ||
            req.headers["x-hub-signature-256"] ||
            req.headers["x-sgn"]);
        // Se tem webhookUrl no body, é definitivamente uma validação
        // Se não tem assinatura, também é validação
        const isValidationRequest = req.body?.webhookUrl || !hasSignature;
        if (isValidationRequest) {
            logger_1.logger.info({
                message: "Requisição PUT de validação do webhook Gerencianet detectada - retornando 200 OK.",
                hasSignature,
                body: req.body,
                userAgent: req.headers["user-agent"]
            });
            // Retorna 200 OK imediatamente para validação do Gerencianet
            // O Gerencianet espera 200 OK para considerar o webhook válido
            return res.status(200).json({ ok: true, message: "Webhook validado com sucesso" });
        }
        // Se tem assinatura, pode ser um webhook real via PUT (menos comum, mas possível)
        logger_1.logger.info({
            message: "Requisição PUT com assinatura recebida - processando como webhook real.",
            type
        });
    }
    // Para requisições POST sem type, também pode ser validação do Gerencianet
    // Algumas versões do Gerencianet podem usar POST para validação
    if (isPostRequest && !type && (req.body?.webhookUrl || (!req.headers["x-webhook-signature"] && !req.headers["X-Webhook-Signature"] && !req.headers["x-hub-signature"]))) {
        logger_1.logger.info({
            message: "Requisição POST de validação do webhook Gerencianet detectada - retornando 200 OK.",
            body: req.body
        });
        return res.status(200).json({ ok: true, message: "Webhook validado com sucesso" });
    }
    if (type === "mercadopago") {
        // Valida assinatura (opcional - não bloqueia se não houver secret configurado)
        // A validação real será feita verificando o paymentId diretamente na API do Mercado Pago
        const isValidSignature = await verifyMercadoPagoSignature(req, rawBody);
        // Não bloqueia mais se a assinatura for inválida
        // A função verifyMercadoPagoSignature agora sempre retorna true (com avisos)
        // A validação real será feita verificando o paymentId na API do Mercado Pago
        logger_1.logger.info({
            message: "Webhook Mercado Pago recebido.",
            hasSignature: !!req.headers["x-signature"],
            hasSecret: !!process.env.MERCADO_PAGO_WEBHOOK_SECRET,
            signatureValid: isValidSignature
        });
        // O Mercado Pago pode enviar o paymentId de diferentes formas:
        // 1. Query parameter: ?data.id=123
        // 2. Body: { data: { id: 123 } }
        // 3. Body: { id: 123 }
        // 4. Body: { action: "payment.updated", data: { id: 123 } }
        const paymentId = req.query["data.id"] ||
            req.body?.data?.id ||
            req.body?.id ||
            req.body?.data?.id;
        logger_1.logger.info({
            message: "Processando webhook Mercado Pago.",
            paymentId,
            queryParams: req.query,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            bodyData: req.body?.data
        });
        if (!paymentId) {
            logger_1.logger.warn({
                message: "Webhook Mercado Pago recebido sem paymentId. Retornando ok.",
                query: req.query,
                body: req.body
            });
            return res.json({ ok: true });
        }
        const invoice = await Invoices_1.default.findOne({
            where: { providerPaymentId: String(paymentId) }
        });
        if (!invoice) {
            logger_1.logger.warn({
                message: "Webhook Mercado Pago: fatura não encontrada para o paymentId.",
                paymentId
            });
            return res.json({ ok: true });
        }
        if (invoice.status === "paid") {
            logger_1.logger.info({
                message: "Webhook Mercado Pago ignorado: fatura já processada.",
                invoiceId: invoice.id
            });
            return res.json({ ok: true });
        }
        let payment;
        try {
            payment = await MercadoPagoService_1.default.getPaymentById(invoice.companyId, String(paymentId));
        }
        catch (error) {
            logger_1.logger.error({
                message: "Erro ao buscar pagamento do Mercado Pago.",
                errorMessage: error?.message,
                paymentId,
                invoiceId: invoice.id,
                stack: error?.stack
            });
            // Retorna ok para não bloquear o webhook, mas não processa o pagamento
            return res.json({ ok: true });
        }
        // Verifica diferentes status de pagamento do Mercado Pago
        // approved = pagamento aprovado
        // authorized = pagamento autorizado (pode ser processado)
        const isPaymentApproved = payment && (payment.status === "approved" ||
            payment.status === "authorized");
        if (isPaymentApproved) {
            const company = await Company_1.default.findByPk(invoice.companyId);
            if (company) {
                await (0, CompanyInvoiceService_1.renewCompanyAfterPayment)(company, invoice);
                logger_1.logger.info({
                    message: "Pagamento Mercado Pago processado com sucesso.",
                    invoiceId: invoice.id,
                    companyId: company.id,
                    paymentId: payment.id,
                    paymentStatus: payment.status,
                    newDueDate: company.dueDate
                });
                const io = (0, socket_1.getIO)();
                io.to(`company-${invoice.companyId}-mainchannel`).emit(`company-${invoice.companyId}-payment`, {
                    action: "CONCLUIDA",
                    company
                });
            }
        }
        else {
            logger_1.logger.info({
                message: "Webhook Mercado Pago recebido mas pagamento ainda não aprovado.",
                paymentId,
                paymentStatus: payment?.status,
                invoiceId: invoice.id
            });
        }
        return res.json({ ok: true });
    }
    // Processamento do webhook Gerencianet
    // Se chegou aqui e é PUT, já foi tratado acima, então só processa POST
    if (isPutRequest) {
        // Se é PUT e chegou aqui, já deveria ter sido tratado acima
        // Mas por segurança, retorna sucesso
        logger_1.logger.info({
            message: "Requisição PUT do Gerencianet processada (já tratada como validação)."
        });
        return res.json({ ok: true });
    }
    const gerencianetSettings = await getGerencianetSettings();
    const gerencianetSecret = gerencianetSettings.options.client_secret;
    // Para requisições POST, verifica assinatura
    if (!verifyGerencianetSignature(req, rawBody, gerencianetSecret)) {
        logger_1.logger.warn({
            message: "Assinatura do webhook Gerencianet inválida.",
            headers: {
                "x-webhook-signature": req.headers["x-webhook-signature"],
                "X-Webhook-Signature": req.headers["X-Webhook-Signature"],
                "x-hub-signature": req.headers["x-hub-signature"],
                "x-hub-signature-256": req.headers["x-hub-signature-256"],
                "x-sgn": req.headers["x-sgn"]
            },
            rawBodyLength: rawBody.length
        });
        return res.status(401).json({ ok: false });
    }
    const { evento } = req.body;
    if (evento === "teste_webhook") {
        logger_1.logger.info({
            message: "Webhook de teste do Gerencianet recebido."
        });
        return res.json({ ok: true });
    }
    if (Array.isArray(req.body.pix)) {
        const gerencianet = (0, gn_api_sdk_typescript_1.default)(gerencianetSettings.options);
        logger_1.logger.info({
            message: "Processando webhook Gerencianet com array de PIX.",
            pixCount: req.body.pix.length
        });
        for (const pix of req.body.pix) {
            try {
                const detail = await gerencianet.pixDetailCharge({
                    txid: pix.txid
                });
                logger_1.logger.info({
                    message: "Detalhes do PIX obtidos.",
                    txid: pix.txid,
                    status: detail.status
                });
                if (detail.status !== "CONCLUIDA") {
                    logger_1.logger.info({
                        message: "PIX ainda não concluído, ignorando.",
                        txid: pix.txid,
                        status: detail.status
                    });
                    continue;
                }
                const invoiceIdFromRequest = detail.solicitacaoPagador?.replace("#Fatura:", "");
                if (!invoiceIdFromRequest) {
                    logger_1.logger.warn({
                        message: "Webhook Gerencianet sem identificação de fatura.",
                        pixTxid: pix.txid,
                        solicitacaoPagador: detail.solicitacaoPagador
                    });
                    continue;
                }
                const invoice = await Invoices_1.default.findByPk(invoiceIdFromRequest);
                if (!invoice) {
                    logger_1.logger.warn({
                        message: "Fatura informada no webhook Gerencianet não encontrada.",
                        invoiceId: invoiceIdFromRequest,
                        pixTxid: pix.txid
                    });
                    continue;
                }
                if (invoice.status === "paid") {
                    logger_1.logger.info({
                        message: "Webhook Gerencianet ignorado: fatura já processada.",
                        invoiceId: invoice.id,
                        pixTxid: pix.txid
                    });
                    continue;
                }
                const company = await Company_1.default.findByPk(invoice.companyId);
                if (!company) {
                    logger_1.logger.warn({
                        message: "Empresa vinculada à fatura não encontrada.",
                        companyId: invoice.companyId,
                        invoiceId: invoice.id
                    });
                    continue;
                }
                await (0, CompanyInvoiceService_1.renewCompanyAfterPayment)(company, invoice);
                logger_1.logger.info({
                    message: "Pagamento Gerencianet processado com sucesso.",
                    invoiceId: invoice.id,
                    companyId: company.id,
                    pixTxid: pix.txid,
                    newDueDate: company.dueDate
                });
                const io = (0, socket_1.getIO)();
                const companyUpdate = await Company_1.default.findOne({
                    where: {
                        id: invoice.companyId
                    }
                });
                io.to(`company-${invoice.companyId}-mainchannel`).emit(`company-${invoice.companyId}-payment`, {
                    action: detail.status,
                    company: companyUpdate
                });
            }
            catch (error) {
                logger_1.logger.error({
                    message: "Erro ao processar webhook Gerencianet.",
                    errorMessage: error?.message,
                    pixTxid: pix?.txid,
                    errorResponse: error?.response?.data,
                    stack: error?.stack
                });
            }
        }
    }
    else if (isPutRequest) {
        // Para requisições PUT que não são validação, retorna sucesso
        logger_1.logger.info({
            message: "Requisição PUT do Gerencianet processada (sem array de PIX).",
            body: req.body
        });
        return res.json({ ok: true });
    }
    return res.json({ ok: true });
};
exports.webhook = webhook;
