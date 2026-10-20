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
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeInMemoryStore = void 0;
// import KeyedDB from "@adiwajshing/keyed-db";
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const makeInMemoryStore = (config = {}) => {
    const { logger: storeLogger = logger_1.logger } = config;
    const chats = [];
    const contacts = {};
    const messages = {};
    const groupMetadata = {};
    const presences = {};
    let state = {
        connection: "close",
        lastDisconnect: undefined,
        isNewLogin: undefined,
        qr: undefined,
        receivedPendingNotifications: false
    };
    // Função para criar estrutura de mensagens para um chat
    const createMessageStore = (jid) => {
        const messagesArray = [];
        return {
            array: messagesArray,
            get: (id) => messagesArray.find(msg => msg.key?.id === id),
            upsert: (item, mode) => {
                const existingIndex = messagesArray.findIndex(msg => msg.key?.id === item.key?.id);
                if (existingIndex >= 0) {
                    messagesArray[existingIndex] = item;
                }
                else {
                    if (mode === "prepend") {
                        messagesArray.unshift(item);
                    }
                    else {
                        messagesArray.push(item);
                    }
                }
            },
            update: (item) => {
                const index = messagesArray.findIndex(msg => msg.key?.id === item.key?.id);
                if (index >= 0) {
                    messagesArray[index] = item;
                    return true;
                }
                return false;
            },
            remove: (item) => {
                const index = messagesArray.findIndex(msg => msg.key?.id === item.key?.id);
                if (index >= 0) {
                    messagesArray.splice(index, 1);
                    return true;
                }
                return false;
            },
            updateAssign: (id, update) => {
                const index = messagesArray.findIndex(msg => msg.key?.id === id);
                if (index >= 0) {
                    messagesArray[index] = { ...messagesArray[index], ...update };
                    return true;
                }
                return false;
            },
            clear: () => {
                messagesArray.length = 0;
            },
            filter: (contain) => {
                const filtered = messagesArray.filter(contain);
                messagesArray.length = 0;
                messagesArray.push(...filtered);
            },
            toJSON: () => messagesArray,
            fromJSON: (newItems) => {
                messagesArray.length = 0;
                messagesArray.push(...newItems);
            }
        };
    };
    // Inicializar store de mensagens para chats existentes
    const initializeMessageStore = (jid) => {
        if (!messages[jid]) {
            messages[jid] = createMessageStore(jid);
        }
        return messages[jid];
    };
    const bind = (ev) => {
        ev.on("connection.update", (update) => {
            state = { ...state, ...update };
        });
        ev.on("chats.upsert", (chatsToUpsert) => {
            for (const chat of chatsToUpsert) {
                const existingIndex = chats.findIndex(c => c.id === chat.id);
                if (existingIndex >= 0) {
                    chats[existingIndex] = chat;
                }
                else {
                    chats.push(chat);
                }
            }
        });
        ev.on("chats.update", (updates) => {
            for (const update of updates) {
                const chatIndex = chats.findIndex(c => c.id === update.id);
                if (chatIndex >= 0) {
                    Object.assign(chats[chatIndex], update);
                }
            }
        });
        ev.on("chats.delete", (deletedChats) => {
            for (const chatId of deletedChats) {
                const chatIndex = chats.findIndex(c => c.id === chatId);
                if (chatIndex >= 0) {
                    chats.splice(chatIndex, 1);
                }
                delete messages[chatId];
            }
        });
        ev.on("contacts.upsert", (contactsToUpsert) => {
            for (const contact of contactsToUpsert) {
                contacts[contact.id] = contact;
            }
        });
        ev.on("contacts.update", (updates) => {
            for (const update of updates) {
                if (contacts[update.id]) {
                    Object.assign(contacts[update.id], update);
                }
            }
        });
        ev.on("messages.upsert", ({ messages: newMessages, type }) => {
            for (const message of newMessages) {
                const jid = message.key.remoteJid;
                if (jid) {
                    initializeMessageStore(jid);
                    messages[jid].upsert(message, type === "notify" ? "prepend" : "append");
                }
            }
        });
        ev.on("messages.update", (updates) => {
            for (const update of updates) {
                const jid = update.key.remoteJid;
                if (jid && messages[jid]) {
                    messages[jid].updateAssign(update.key.id, update);
                }
            }
        });
        ev.on("messages.delete", (deletions) => {
            if (Array.isArray(deletions)) {
                for (const deletion of deletions) {
                    if (deletion.keys && Array.isArray(deletion.keys)) {
                        const jid = deletion.keys[0]?.remoteJid;
                        if (jid && messages[jid]) {
                            for (const key of deletion.keys) {
                                messages[jid].remove({ key });
                            }
                        }
                    }
                }
            }
        });
        ev.on("groups.upsert", (groups) => {
            for (const group of groups) {
                groupMetadata[group.id] = group;
            }
        });
        ev.on("groups.update", (updates) => {
            for (const update of updates) {
                if (groupMetadata[update.id]) {
                    Object.assign(groupMetadata[update.id], update);
                }
            }
        });
        ev.on("group-participants.update", (updates) => {
            if (Array.isArray(updates)) {
                for (const update of updates) {
                    if (groupMetadata[update.id]) {
                        const group = groupMetadata[update.id];
                        if (update.action === "add") {
                            group.participants.push(...update.participants.map(id => ({ id, admin: "false" })));
                        }
                        else if (update.action === "remove") {
                            group.participants = group.participants.filter(p => !update.participants.includes(p.id));
                        }
                    }
                }
            }
        });
        ev.on("presence.update", ({ id, presences: newPresences }) => {
            presences[id] = presences[id] || {};
            Object.assign(presences[id], newPresences);
        });
    };
    const loadMessages = async (jid, count, cursor, sock) => {
        if (!sock)
            return [];
        try {
            // Retornar mensagens do store local
            initializeMessageStore(jid);
            return messages[jid].array.slice(0, count);
        }
        catch (error) {
            storeLogger.error("Error loading messages:", error);
            return [];
        }
    };
    const loadMessage = async (jid, id, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        try {
            // Buscar mensagem no store local
            initializeMessageStore(jid);
            const result = messages[jid].get(id);
            if (result) {
                return result;
            }
            throw new Error("Message not found");
        }
        catch (error) {
            storeLogger.error("Error loading message:", error);
            throw error;
        }
    };
    const mostRecentMessage = async (jid, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        try {
            // Buscar mensagem mais recente no store local
            initializeMessageStore(jid);
            const messageArray = messages[jid].array;
            if (messageArray.length > 0) {
                return messageArray[messageArray.length - 1];
            }
            throw new Error("No messages found");
        }
        catch (error) {
            storeLogger.error("Error loading most recent message:", error);
            throw error;
        }
    };
    const fetchImageUrl = async (jid, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        return await sock.profilePictureUrl(jid);
    };
    const fetchGroupMetadata = async (jid, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        try {
            const result = await sock.groupMetadata(jid);
            groupMetadata[jid] = result;
            return result;
        }
        catch (error) {
            storeLogger.error("Error fetching group metadata:", error);
            throw error;
        }
    };
    const fetchBroadcastListInfo = async (jid, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        try {
            const result = await sock.groupMetadata(jid);
            groupMetadata[jid] = result;
            return result;
        }
        catch (error) {
            storeLogger.error("Error fetching broadcast list info:", error);
            throw error;
        }
    };
    const fetchMessageReceipts = async (jid, messageId, sock) => {
        if (!sock)
            throw new Error("Socket not available");
        try {
            // Buscar receipts no store local
            initializeMessageStore(jid);
            const message = messages[jid].get(messageId);
            return message?.userReceipt || [];
        }
        catch (error) {
            storeLogger.error("Error fetching message receipts:", error);
            return [];
        }
    };
    const readFromFile = (filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, "utf8");
                const json = JSON.parse(data);
                fromJSON(json);
                storeLogger.info(`Store loaded from ${filePath}`);
            }
        }
        catch (error) {
            storeLogger.error("Error reading store from file:", error);
        }
    };
    const writeToFile = (filePath) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const json = toJSON();
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
            storeLogger.info(`Store saved to ${filePath}`);
        }
        catch (error) {
            storeLogger.error("Error writing store to file:", error);
        }
    };
    const toJSON = () => ({
        chats,
        contacts,
        messages: Object.keys(messages).reduce((acc, jid) => {
            acc[jid] = messages[jid].toJSON();
            return acc;
        }, {}),
        groupMetadata,
        state,
        presences
    });
    const fromJSON = (json) => {
        if (json.chats) {
            chats.length = 0;
            for (const chat of json.chats) {
                const existingIndex = chats.findIndex(c => c.id === chat.id);
                if (existingIndex >= 0) {
                    chats[existingIndex] = chat;
                }
                else {
                    chats.push(chat);
                }
            }
        }
        if (json.contacts) {
            Object.assign(contacts, json.contacts);
        }
        if (json.messages) {
            Object.keys(json.messages).forEach(jid => {
                initializeMessageStore(jid);
                messages[jid].fromJSON(json.messages[jid]);
            });
        }
        if (json.groupMetadata) {
            Object.assign(groupMetadata, json.groupMetadata);
        }
        if (json.state) {
            state = { ...state, ...json.state };
        }
        if (json.presences) {
            Object.assign(presences, json.presences);
        }
    };
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        bind,
        loadMessages,
        loadMessage,
        mostRecentMessage,
        fetchImageUrl,
        fetchGroupMetadata,
        fetchBroadcastListInfo,
        fetchMessageReceipts,
        readFromFile,
        writeToFile,
        toJSON,
        fromJSON
    };
};
exports.makeInMemoryStore = makeInMemoryStore;
