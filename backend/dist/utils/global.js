"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLidFromMessage = exports.getJidFromMessage = exports.buildContactAddress = exports.getContactIdentifier = exports.map_msg = void 0;
const logger_1 = require("./logger");
exports.map_msg = new Map();
const getContactIdentifier = (contact) => {
    if (!contact) {
        console.log("Contact é nulo ou indefinido:", contact);
        return "";
    }
    if (contact?.dataValues) {
        contact = contact.dataValues;
    }
    console.log("Usando NUMBER para envio:", contact.number);
    return contact.number;
};
exports.getContactIdentifier = getContactIdentifier;
// Função helper para construir o endereço de envio
const buildContactAddress = (contact, isGroup) => {
    // console.log('Contact recebido em buildContactAddress:', contact, 'isGroup:', isGroup);
    const contactId = (0, exports.getContactIdentifier)(contact);
    const domain = isGroup ? "@g.us" : contactId.includes("@") ? "" : "@s.whatsapp.net";
    return `${contactId}${domain}`;
};
exports.buildContactAddress = buildContactAddress;
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
const normalizeJid = (jid) => {
    if (!jid || typeof jid !== "string")
        return "";
    const trimmed = jid.trim();
    if (!trimmed.includes("@"))
        return trimmed;
    const [localPart, domain] = trimmed.split("@");
    return `${localPart.split(":")[0]}@${domain}`;
};
const resolvePnFromLid = async (lid, wbot) => {
    if (!lid || !lid.includes("@lid"))
        return "";
    try {
        const lidMappingStore = wbot?.lidMappingStore;
        if (lidMappingStore?.getPNForLID) {
            const mappedJid = await lidMappingStore.getPNForLID(lid);
            if (typeof mappedJid === "string" && mappedJid.includes("@s.whatsapp.net")) {
                return normalizeJid(mappedJid);
            }
        }
    }
    catch (error) {
        logger_1.logger.warn(`Falha ao resolver PN a partir do LID ${lid}: ${error.message}`);
    }
    return "";
};
const getJidFromMessage = async (message, wbot) => {
    if (!message || !message.key) {
        throw new Error("Mensagem inválida: propriedade key não encontrada");
    }
    const { key } = message;
    const keyAny = key;
    const remoteJid = normalizeJid(keyAny.remoteJid || "");
    const participant = normalizeJid(keyAny.participant || "");
    const senderPn = normalizeJid(keyAny.sender_pn || "");
    const peerRecipientPn = normalizeJid(keyAny.peer_recipient_pn || "");
    let jid = "";
    if (remoteJid.includes("@s.whatsapp.net") || remoteJid.includes("@g.us")) {
        jid = remoteJid;
    }
    else if (participant.includes("@s.whatsapp.net")) {
        jid = participant;
    }
    else if (senderPn.includes("@s.whatsapp.net")) {
        jid = senderPn;
    }
    else if (peerRecipientPn.includes("@s.whatsapp.net")) {
        jid = peerRecipientPn;
    }
    else if (remoteJid.includes("@lid")) {
        jid = await resolvePnFromLid(remoteJid, wbot);
    }
    else if (participant.includes("@lid")) {
        jid = await resolvePnFromLid(participant, wbot);
    }
    if (!jid) {
        console.log("JID final para envio: (vazio - remoteJid/participant/sender_pn/peer_recipient_pn não disponíveis)", {
            remoteJid,
            participant,
            sender_pn: senderPn,
            peer_recipient_pn: peerRecipientPn
        });
        throw new Error("Não foi possível obter JID da mensagem");
    }
    const normalizedJid = normalizeJid(jid);
    console.log("JID final para envio:", normalizedJid);
    return normalizedJid;
};
exports.getJidFromMessage = getJidFromMessage;
const getLidFromMessage = async (message, wbot) => {
    if (!message || !message.key) {
        throw new Error("Mensagem inválida: propriedade key não encontrada");
    }
    const keyAny = message.key;
    const participant = normalizeJid(keyAny.participant || "");
    const remoteJid = normalizeJid(keyAny.remoteJid || "");
    if (participant.includes("@lid")) {
        return participant;
    }
    if (remoteJid.includes("@lid")) {
        return remoteJid;
    }
    return "";
};
exports.getLidFromMessage = getLidFromMessage;
