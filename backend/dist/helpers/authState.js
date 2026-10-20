"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const libzapitu_rf_1 = require("libzapitu-rf");
const cache_1 = require("../libs/cache");
const logger_1 = require("../utils/logger");
const KEY_MAP = {
    "pre-key": "preKeys",
    session: "sessions",
    "sender-key": "senderKeys",
    "app-state-sync-key": "appStateSyncKeys",
    "app-state-sync-version": "appStateVersions",
    "sender-key-memory": "senderKeyMemory",
    "contacts-tc-token": "contactsTcToken"
};
const authState = async (whatsapp) => {
    let creds;
    const whatsappId = whatsapp.id;
    const getRedisKey = (type, id) => `sessions:${whatsappId}:${type}-${id}`;
    const saveKey = async (type, id, value) => {
        await cache_1.cacheLayer.set(getRedisKey(type, id), JSON.stringify(value, libzapitu_rf_1.BufferJSON.replacer));
    };
    const getKey = async (type, id) => {
        const value = await cache_1.cacheLayer.get(getRedisKey(type, id));
        if (!value) {
            return null;
        }
        return JSON.parse(value, libzapitu_rf_1.BufferJSON.reviver);
    };
    const removeKey = async (type, id) => {
        await cache_1.cacheLayer.del(getRedisKey(type, id));
    };
    const saveState = async () => {
        try {
            await whatsapp.update({
                session: JSON.stringify({ creds, keys: {} }, libzapitu_rf_1.BufferJSON.replacer, 0)
            });
        }
        catch (error) {
            console.log(error);
        }
    };
    const migrateLegacyKeys = async (legacyKeys) => {
        const categories = Object.keys(legacyKeys || {});
        if (!categories.length) {
            return;
        }
        logger_1.logger.info(`Migrando chaves legadas do WhatsApp ${whatsappId} para armazenamento em Redis`);
        const tasks = [];
        for (const category of categories) {
            const entries = legacyKeys[category] || {};
            for (const id of Object.keys(entries)) {
                tasks.push(saveKey(category, id, entries[id]));
            }
        }
        await Promise.all(tasks);
    };
    if (whatsapp.session && whatsapp.session !== null) {
        const result = JSON.parse(whatsapp.session, libzapitu_rf_1.BufferJSON.reviver);
        if (result.creds) {
            creds = result.creds;
            if (result.keys && Object.keys(result.keys).length > 0) {
                await migrateLegacyKeys(result.keys);
                await saveState();
            }
        }
        else {
            creds = (0, libzapitu_rf_1.initAuthCreds)();
        }
    }
    else {
        creds = (0, libzapitu_rf_1.initAuthCreds)();
    }
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await getKey(type, id);
                        if (value) {
                            if (type === "app-state-sync-key") {
                                value = libzapitu_rf_1.proto.Message.AppStateSyncKeyData.create(value);
                            }
                            data[id] = value;
                        }
                        if (!value) {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        const key = KEY_MAP[category];
                        if (!key) {
                            continue;
                        }
                        for (const id in data[category]) {
                            const value = data[category][id];
                            tasks.push(value ? saveKey(category, id, value) : removeKey(category, id));
                        }
                    }
                    await Promise.all(tasks);
                    await saveState();
                }
            }
        },
        saveState
    };
};
exports.default = authState;
