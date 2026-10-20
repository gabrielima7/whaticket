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
exports.initWASocket = exports.msgDB = exports.restartWbot = exports.removeWbot = exports.getWbot = void 0;
const Sentry = __importStar(require("@sentry/node"));
const libzapitu_rf_1 = __importStar(require("libzapitu-rf"));
const sequelize_1 = require("sequelize");
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const logger_1 = require("../utils/logger");
const authState_1 = __importDefault(require("../helpers/authState"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const socket_1 = require("./socket");
const StartWhatsAppSession_1 = require("../services/WbotServices/StartWhatsAppSession");
const DeleteBaileysService_1 = __importDefault(require("../services/BaileysServices/DeleteBaileysService"));
const wbotMessageListener_1 = require("../services/WbotServices/wbotMessageListener");
const wbotMonitor_1 = __importDefault(require("../services/WbotServices/wbotMonitor"));
const node_cache_1 = __importDefault(require("node-cache"));
const Contact_1 = __importDefault(require("../models/Contact"));
const Ticket_1 = __importDefault(require("../models/Ticket"));
const GroupEncryptionService_1 = __importDefault(require("../services/BaileysServices/GroupEncryptionService"));
const waversion_json_1 = __importDefault(require("../waversion.json"));
const KEY_MAP = {
    "pre-key": "preKeys",
    session: "sessions",
    "sender-key": "senderKeys",
    "app-state-sync-key": "appStateSyncKeys",
    "app-state-sync-version": "appStateVersions",
    "sender-key-memory": "senderKeyMemory",
    "contacts-tc-token": "contactsTcToken"
};
// Função para extrair número de telefone do JID
// Suporta números de qualquer país (até 15 dígitos conforme padrão internacional)
const extractPhoneNumber = (jid) => {
    if (!jid || typeof jid !== 'string')
        return '';
    // Remove caracteres não numéricos
    const cleanNumber = jid.replace(/[^0-9]/g, "");
    // Limita a 15 dígitos - padrão internacional máximo para números de telefone
    return cleanNumber.slice(0, 15);
};
const msgRetryCounterCache = new node_cache_1.default({
    stdTTL: 600,
    maxKeys: 1000,
    checkperiod: 300,
    useClones: false
});
const msgCache = new node_cache_1.default({
    stdTTL: 60,
    maxKeys: 1000,
    checkperiod: 300,
    useClones: false
});
function msg() {
    return {
        get: (key) => {
            const { id } = key;
            if (!id)
                return;
            let data = msgCache.get(id);
            if (data) {
                try {
                    let msg = JSON.parse(data);
                    return msg?.message;
                }
                catch (error) {
                    logger_1.logger.error(error);
                }
            }
        },
        save: (msg) => {
            const { id } = msg.key;
            const msgtxt = JSON.stringify(msg);
            try {
                msgCache.set(id, msgtxt);
            }
            catch (error) {
                logger_1.logger.error(error);
            }
        }
    };
}
exports.default = msg;
const sessions = [];
const retriesQrCodeMap = new Map();
// Contador de tentativas de reconexão para erro 403
const reconnectAttempts = new Map();
// Rate limiting para evitar reconexões muito frequentes
const lastReconnectTime = new Map();
const MIN_RECONNECT_INTERVAL = 10000; // 10 segundos mínimo entre reconexões
// Função helper para reconexão com rate limiting
const scheduleReconnect = (whatsapp, delay, reason) => {
    const now = Date.now();
    const lastTime = lastReconnectTime.get(whatsapp.id) || 0;
    const timeSinceLastReconnect = now - lastTime;
    if (timeSinceLastReconnect < MIN_RECONNECT_INTERVAL) {
        const adjustedDelay = MIN_RECONNECT_INTERVAL - timeSinceLastReconnect + delay;
        logger_1.logger.warn(`Rate limiting: aguardando ${adjustedDelay}ms antes de reconectar ${whatsapp.name} (${reason})`);
        delay = adjustedDelay;
    }
    lastReconnectTime.set(whatsapp.id, now + delay);
    setTimeout(() => {
        logger_1.logger.info(`Iniciando reconexão para ${whatsapp.name} (${reason})`);
        (0, StartWhatsAppSession_1.StartWhatsAppSession)(whatsapp, whatsapp.companyId);
    }, delay);
};
const getWbot = (whatsappId) => {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex === -1) {
        throw new AppError_1.default("ERR_WAPP_NOT_INITIALIZED");
    }
    return sessions[sessionIndex];
};
exports.getWbot = getWbot;
const removeWbot = async (whatsappId, isLogout = true) => {
    try {
        const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
        if (sessionIndex !== -1) {
            if (isLogout) {
                sessions[sessionIndex].logout();
                sessions[sessionIndex].ws.close();
            }
            sessions.splice(sessionIndex, 1);
        }
    }
    catch (err) {
        logger_1.logger.error(err);
    }
};
exports.removeWbot = removeWbot;
const restartWbot = async (companyId, session) => {
    try {
        const options = {
            where: {
                companyId,
            },
            attributes: ["id"],
        };
        const whatsapp = await Whatsapp_1.default.findAll(options);
        whatsapp.map(async (c) => {
            const sessionIndex = sessions.findIndex(s => s.id === c.id);
            if (sessionIndex !== -1) {
                sessions[sessionIndex].ws.close();
            }
        });
    }
    catch (err) {
        logger_1.logger.error(err);
    }
};
exports.restartWbot = restartWbot;
exports.msgDB = msg();
const waVersionCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 24,
    checkperiod: 60 * 30,
    useClones: false
});
const getAutoWAVersion = async () => {
    const cached = waVersionCache.get("waVersion");
    if (cached && cached.length === 3)
        return cached;
    try {
        const res = await fetch("https://waversion.ticke.tz");
        const data = (await res.json());
        if (Array.isArray(data) && data.length >= 3) {
            const version = [
                data[0] ?? 2,
                data[1] ?? 3000,
                data[2] ?? 0
            ];
            waVersionCache.set("waVersion", version);
            return version;
        }
    }
    catch (error) {
        logger_1.logger.warn("Failed to get current WA Version from project repository, using local waversion.json");
    }
    const localWaVersion = Array.isArray(waversion_json_1.default)
        ? waversion_json_1.default
        : waversion_json_1.default?.version;
    const fallback = Array.isArray(localWaVersion) && localWaVersion.length >= 3
        ? [localWaVersion[0], localWaVersion[1], localWaVersion[2]]
        : [2, 3000, 0];
    waVersionCache.set("waVersion", fallback);
    return fallback;
};
const initWASocket = async (whatsapp) => {
    return new Promise(async (resolve, reject) => {
        try {
            (async () => {
                const io = (0, socket_1.getIO)();
                const whatsappUpdate = await Whatsapp_1.default.findOne({
                    where: { id: whatsapp.id }
                });
                if (!whatsappUpdate)
                    return;
                // Verificar se já existe uma sessão ativa e se está conectado
                if (whatsappUpdate.status === "CONNECTED") {
                    const existingSessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                    if (existingSessionIndex !== -1) {
                        const existingSession = sessions[existingSessionIndex];
                        logger_1.logger.info(`WhatsApp ${whatsappUpdate.name} (ID: ${whatsapp.id}) já está CONNECTED e tem sessão ativa. Reutilizando sessão existente.`);
                        resolve(existingSession);
                        return;
                    }
                    else {
                        // Status é CONNECTED mas não há sessão na memória - pode ser um restart do servidor
                        // Atualizar status para DISCONNECTED e continuar para criar nova sessão
                        logger_1.logger.warn(`WhatsApp ${whatsappUpdate.name} (ID: ${whatsapp.id}) está marcado como CONNECTED mas não tem sessão na memória. Atualizando status e criando nova sessão.`);
                        await whatsappUpdate.update({ status: "DISCONNECTED" });
                        // Continuar para criar nova sessão
                    }
                }
                else {
                    // Se não está CONNECTED, remover sessão antiga se existir
                    const existingSessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                    if (existingSessionIndex !== -1) {
                        logger_1.logger.info(`Removendo sessão antiga para ${whatsappUpdate.name} (ID: ${whatsapp.id}) antes de criar nova.`);
                        await (0, exports.removeWbot)(whatsapp.id, false);
                    }
                }
                const { id, name, provider } = whatsappUpdate;
                const version = await getAutoWAVersion();
                const isLegacy = provider === "stable" ? true : false;
                logger_1.logger.info(`using WA v${version.join(".")}`);
                logger_1.logger.info(`isLegacy: ${isLegacy}`);
                logger_1.logger.info(`Starting session ${name}`);
                let retriesQrCode = 0;
                let wsocket = null;
                // Removido makeInMemoryStore que não existe mais na versão 6.7.16
                // Usando apenas caches externos conforme exemplo oficial
                const { state, saveState } = await (0, authState_1.default)(whatsapp);
                // libzapitu: não usar makeCacheableSignalKeyStore — passar state.keys direto (recomendação da lib)
                // Verificar e inicializar chaves Signal para grupos se necessário
                if (!state.keys) {
                    logger_1.logger.warn(`Chaves Signal não encontradas para ${name}, inicializando...`);
                    // Forçar inicialização das chaves se não existirem
                    state.keys = {
                        get: (type, ids) => {
                            const key = KEY_MAP[type];
                            return ids.reduce((dict, id) => {
                                let value = state.keys[key]?.[id];
                                if (value) {
                                    if (type === "app-state-sync-key") {
                                        value = libzapitu_rf_1.proto.Message.AppStateSyncKeyData.create(value);
                                    }
                                    dict[id] = value;
                                }
                                return dict;
                            }, {});
                        },
                        set: (data) => {
                            for (const i in data) {
                                const key = KEY_MAP[i];
                                state.keys[key] = state.keys[key] || {};
                                Object.assign(state.keys[key], data[i]);
                            }
                            saveState();
                        }
                    };
                }
                const groupCache = new node_cache_1.default({
                    stdTTL: 3600,
                    maxKeys: 10000,
                    checkperiod: 600,
                    useClones: false
                });
                const cachedGroupMetadata = async (jid) => {
                    let data = groupCache.get(jid);
                    console.log('cachedGroupMetadata jid:', jid, 'data:', !!data);
                    if (data) {
                        return data;
                    }
                    else {
                        const result = await wsocket.groupMetadata(jid);
                        groupCache.set(jid, result);
                        return result;
                    }
                };
                wsocket = (0, libzapitu_rf_1.default)({
                    logger: logger_1.logger,
                    printQRInTerminal: false,
                    auth: {
                        creds: state.creds,
                        keys: state.keys,
                    },
                    version,
                    browser: libzapitu_rf_1.Browsers.appropriate("Desktop"),
                    defaultQueryTimeoutMs: undefined,
                    msgRetryCounterCache,
                    markOnlineOnConnect: false,
                    connectTimeoutMs: 25000,
                    retryRequestDelayMs: 500,
                    getMessage: exports.msgDB.get,
                    emitOwnEvents: true,
                    fireInitQueries: true,
                    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                    shouldIgnoreJid: jid => (0, libzapitu_rf_1.isJidBroadcast)(jid),
                    cachedGroupMetadata,
                });
                // PATCH ESPECÍFICO - Converter objetos Object() para Buffer
                const originalBufferFrom = Buffer.from;
                Buffer.from = function (value, ...args) {
                    try {
                        // Interceptar APENAS objetos Object() que não são válidos para Buffer.from
                        if (typeof value === 'object' && value !== null &&
                            !Array.isArray(value) &&
                            !Buffer.isBuffer(value) &&
                            !(value instanceof Uint8Array) && // NÃO interceptar Uint8Array
                            !(value instanceof ArrayBuffer) && // NÃO interceptar ArrayBuffer
                            value.constructor === Object) { // APENAS objetos Object()
                            // Tentar converter o objeto Object() para array e depois para Buffer
                            try {
                                const keys = Object.keys(value);
                                const isNumericKeys = keys.every(key => /^\d+$/.test(key));
                                if (isNumericKeys && keys.length > 0) {
                                    // Converter objeto com chaves numéricas para array
                                    const maxIndex = Math.max(...keys.map(k => parseInt(k)));
                                    const array = new Array(maxIndex + 1);
                                    for (let i = 0; i <= maxIndex; i++) {
                                        array[i] = value[i] || 0;
                                    }
                                    const buffer = Buffer.from(array);
                                    return buffer;
                                }
                                else {
                                    return originalBufferFrom.call(this, value, ...args);
                                }
                            }
                            catch (conversionError) {
                                return originalBufferFrom.call(this, value, ...args);
                            }
                        }
                        return originalBufferFrom.call(this, value, ...args);
                    }
                    catch (error) {
                        return originalBufferFrom.call(this, value, ...args);
                    }
                };
                wsocket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
                    logger_1.logger.info(`Socket ${name} Connection Update: ${connection}`);
                    // Log detalhado de desconexões
                    if (lastDisconnect) {
                        const error = lastDisconnect.error;
                        const statusCode = error?.output?.statusCode;
                        const errorMessage = error?.message;
                        logger_1.logger.warn(`Desconexão detectada para ${name}:`, {
                            statusCode,
                            message: errorMessage,
                            timestamp: new Date().toISOString()
                        });
                        // Tratamento específico para erros de stream do Baileys
                        if (statusCode === 515) {
                            logger_1.logger.warn(`Erro 515 (restart required) para ${name} - Pareamento aceito, reiniciando conexao sem limpar a sessao`);
                        }
                        else if (statusCode === 401) {
                            logger_1.logger.warn(`Erro 401 (device_removed) para ${name} - Dispositivo removido, aguardando QR`);
                        }
                    }
                    const disconect = lastDisconnect?.error?.output?.statusCode;
                    if (connection === "close") {
                        // Tratamento específico para diferentes tipos de erro
                        if (disconect === 515) {
                            // Erro 515: restart required apos pareamento. Preserva credenciais e reconecta.
                            logger_1.logger.warn(`Erro 515 (restart required) para ${name} - Reconectando com a sessao pareada`);
                            await saveState();
                            await (0, exports.removeWbot)(id, false);
                            scheduleReconnect(whatsapp, 1000, "erro 515 - restart required");
                            return;
                        }
                        // Connection Terminated (428) - WebSocket fechou (rede, servidor, idle). Reconectar.
                        if (disconect === libzapitu_rf_1.DisconnectReason.connectionClosed) {
                            logger_1.logger.warn(`Connection Terminated (428) para ${name} - Reconectando em 3s (rede/servidor/idle)`);
                            (0, exports.removeWbot)(id, false);
                            scheduleReconnect(whatsapp, 3000, "connection terminated");
                            return;
                        }
                        // connectionLost / timedOut (408) - conexão perdida ou timeout
                        if (disconect === libzapitu_rf_1.DisconnectReason.connectionLost || disconect === 408) {
                            logger_1.logger.warn(`Conexão perdida/timeout (408) para ${name} - Reconectando`);
                            (0, exports.removeWbot)(id, false);
                            scheduleReconnect(whatsapp, 3000, "connection lost/timeout");
                            return;
                        }
                        if (disconect === 401) {
                            // Erro 401: device_removed - dispositivo foi removido, precisa de novo QR
                            logger_1.logger.warn(`Erro 401 (device_removed) para ${name} - Limpando sessão para novo QR`);
                            await whatsapp.update({ status: "PENDING", qrcode: "", session: "", number: "" });
                            (0, exports.removeWbot)(id, false);
                            await (0, DeleteBaileysService_1.default)(whatsapp.id);
                            io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                                action: "update",
                                session: whatsapp
                            });
                            return;
                        }
                        if (disconect === 403) {
                            logger_1.logger.warn(`Erro 403 detectado para ${name}. Tentando reconexão inteligente...`);
                            // NÃO deletar dados imediatamente - tentar reconectar primeiro
                            const attempts = reconnectAttempts.get(id) || 0;
                            if (attempts < 5) { // Máximo 5 tentativas
                                logger_1.logger.info(`Tentativa ${attempts + 1} de reconexão para ${name}`);
                                reconnectAttempts.set(id, attempts + 1);
                                // Tentar reconectar sem deletar dados
                                const delay = [2000, 5000, 10000, 30000, 60000][attempts];
                                scheduleReconnect(whatsapp, delay, `erro 403 - tentativa ${attempts + 1}`);
                                return; // NÃO deletar dados ainda
                            }
                            else {
                                // Após 5 tentativas, então deletar dados
                                logger_1.logger.error(`Máximo de tentativas atingido para ${name}. Deletando sessão.`);
                                await whatsapp.update({ status: "PENDING", qrcode: "", session: "", number: "" });
                                (0, exports.removeWbot)(id, false);
                                await (0, DeleteBaileysService_1.default)(whatsapp.id);
                                reconnectAttempts.delete(id);
                                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                                    action: "update",
                                    session: whatsapp
                                });
                                return;
                            }
                        }
                        if (disconect !== libzapitu_rf_1.DisconnectReason.loggedOut) {
                            (0, exports.removeWbot)(id, false);
                            scheduleReconnect(whatsapp, 2000, "disconnect geral");
                        }
                        else {
                            await whatsapp.update({ status: "PENDING", qrcode: "", session: "", number: "" });
                            await (0, DeleteBaileysService_1.default)(whatsapp.id);
                            io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                                action: "update",
                                session: whatsapp
                            });
                            (0, exports.removeWbot)(id, false);
                        }
                    }
                    if (connection === "open") {
                        // Limpar tentativas de reconexão e rate limiting quando conectar com sucesso
                        reconnectAttempts.delete(id);
                        lastReconnectTime.delete(id);
                        await whatsapp.update({
                            status: "CONNECTED",
                            qrcode: "",
                            retries: 0,
                            number: wsocket.type === "md"
                                ? (0, libzapitu_rf_1.jidNormalizedUser)(wsocket.user.id).split("@")[0]
                                : "-"
                        });
                        io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                            action: "update",
                            session: whatsapp
                        });
                        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                        const isReconnection = sessionIndex !== -1;
                        if (sessionIndex === -1) {
                            wsocket.id = whatsapp.id;
                            sessions.push(wsocket);
                        }
                        else {
                            // Atualizar sessão existente
                            sessions[sessionIndex] = wsocket;
                        }
                        // Se for uma reconexão (sessão já existia), re-registrar listeners
                        if (isReconnection) {
                            logger_1.logger.info(`Reconexão detectada para ${name} (ID: ${id}). Re-registrando listeners...`);
                            // Aguardar um pouco para garantir que a conexão está estável
                            setTimeout(async () => {
                                try {
                                    await (0, wbotMessageListener_1.wbotMessageListener)(wsocket, whatsapp.companyId);
                                    await (0, wbotMonitor_1.default)(wsocket, whatsapp, whatsapp.companyId);
                                    logger_1.logger.info(`Listeners re-registrados com sucesso para ${name} (ID: ${id})`);
                                }
                                catch (err) {
                                    logger_1.logger.error(`Erro ao re-registrar listeners para ${name}: ${err}`);
                                    Sentry.captureException(err);
                                }
                            }, 1000);
                        }
                        else {
                            logger_1.logger.info(`Conexão inicial estabelecida para ${name} (ID: ${id}). Listeners serão registrados pelo StartWhatsAppSession.`);
                        }
                        resolve(wsocket);
                    }
                    if (qr !== undefined) {
                        if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                            await whatsapp.update({
                                status: "DISCONNECTED",
                                qrcode: ""
                            });
                            await (0, DeleteBaileysService_1.default)(whatsapp.id);
                            io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                                action: "update",
                                session: whatsapp
                            });
                            wsocket.ev.removeAllListeners("connection.update");
                            wsocket.ws.close();
                            wsocket = null;
                            retriesQrCodeMap.delete(id);
                        }
                        else {
                            logger_1.logger.info(`Session QRCode Generate ${name}`);
                            retriesQrCodeMap.set(id, (retriesQrCode += 1));
                            await whatsapp.update({
                                qrcode: qr,
                                status: "qrcode",
                                retries: 0,
                                number: ""
                            });
                            const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                            if (sessionIndex === -1) {
                                wsocket.id = whatsapp.id;
                                sessions.push(wsocket);
                            }
                            io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                                action: "update",
                                session: whatsapp
                            });
                        }
                    }
                });
                wsocket.ev.on("creds.update", saveState);
                // Tratamento específico para erros de criptografia de grupos
                wsocket.ev.on("messages.upsert", async (m) => {
                    try {
                        // Log para debug de mensagens de grupo
                        if (m.messages && m.messages.length > 0) {
                            const firstMsg = m.messages[0];
                            if (firstMsg.key.remoteJid?.endsWith("@g.us")) {
                                logger_1.logger.debug(`Mensagem de grupo recebida: ${firstMsg.key.remoteJid}`);
                            }
                        }
                    }
                    catch (error) {
                        logger_1.logger.error("Erro ao processar mensagem de grupo:", error);
                        // Tentar tratar erro de criptografia se for mensagem de grupo
                        if (m.messages && m.messages.length > 0) {
                            const firstMsg = m.messages[0];
                            if (firstMsg.key.remoteJid?.endsWith("@g.us")) {
                                await GroupEncryptionService_1.default.handleGroupEncryptionError(error, firstMsg.key.remoteJid, wsocket);
                            }
                        }
                    }
                });
                // Interceptar erros globais de criptografia
                const originalSendMessage = wsocket.sendMessage;
                wsocket.sendMessage = async (jid, content, options) => {
                    try {
                        return await originalSendMessage.call(wsocket, jid, content, options);
                    }
                    catch (error) {
                        // Se for erro de criptografia em grupo, tentar tratar
                        if (jid.endsWith("@g.us")) {
                            const handled = await GroupEncryptionService_1.default.handleGroupEncryptionError(error, jid, wsocket);
                            if (handled) {
                                // Tentar enviar novamente após tratamento
                                try {
                                    return await originalSendMessage.call(wsocket, jid, content, options);
                                }
                                catch (retryError) {
                                    logger_1.logger.error(`Erro persistente ao enviar mensagem para grupo ${jid}:`, retryError);
                                    throw retryError;
                                }
                            }
                        }
                        throw error;
                    }
                };
                wsocket.ev.on("presence.update", async ({ id: remoteJid, presences }) => {
                    try {
                        logger_1.logger.debug({ remoteJid, presences }, "Received contact presence");
                        if (!presences[remoteJid]?.lastKnownPresence) {
                            return;
                        }
                        const contact = await Contact_1.default.findOne({
                            where: {
                                number: extractPhoneNumber(remoteJid),
                                companyId: whatsapp.companyId
                            }
                        });
                        if (!contact) {
                            return;
                        }
                        const ticket = await Ticket_1.default.findOne({
                            where: {
                                contactId: contact.id,
                                whatsappId: whatsapp.id,
                                status: {
                                    [sequelize_1.Op.or]: ["open", "pending"]
                                }
                            }
                        });
                        if (ticket) {
                            io.to(ticket.id.toString())
                                .to(`company-${whatsapp.companyId}-${ticket.status}`)
                                .to(`queue-${ticket.queueId}-${ticket.status}`)
                                .emit(`company-${whatsapp.companyId}-presence`, {
                                ticketId: ticket.id,
                                presence: presences[remoteJid].lastKnownPresence
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error({ remoteJid, presences }, "presence.update: error processing");
                        if (error instanceof Error) {
                            logger_1.logger.error(`Error: ${error.name} ${error.message}`);
                        }
                        else {
                            logger_1.logger.error(`Error was object of type: ${typeof error}`);
                        }
                    }
                });
                // Removida a linha que vinculava o store ao socket
                // store.bind(wsocket.ev);
            })();
        }
        catch (error) {
            Sentry.captureException(error);
            console.log(error);
            reject(error);
        }
    });
};
exports.initWASocket = initWASocket;
