"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMultiFileAuthState = void 0;
const libzapitu_rf_1 = require("libzapitu-rf");
const libzapitu_rf_2 = require("libzapitu-rf");
const libzapitu_rf_3 = require("libzapitu-rf");
const cache_1 = require("../libs/cache");
const useMultiFileAuthState = async (whatsapp) => {
    const writeData = async (data, file) => {
        try {
            await cache_1.cacheLayer.set(`sessions:${whatsapp.id}:${file}`, JSON.stringify(data, libzapitu_rf_3.BufferJSON.replacer));
        }
        catch (error) {
            console.log("writeData error", error);
            return null;
        }
    };
    const readData = async (file) => {
        try {
            const data = await cache_1.cacheLayer.get(`sessions:${whatsapp.id}:${file}`);
            return JSON.parse(data, libzapitu_rf_3.BufferJSON.reviver);
        }
        catch (error) {
            return null;
        }
    };
    const removeData = async (file) => {
        try {
            await cache_1.cacheLayer.del(`sessions:${whatsapp.id}:${file}`);
        }
        catch { }
    };
    const creds = (await readData("creds")) || (0, libzapitu_rf_2.initAuthCreds)();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === "app-state-sync-key" && value) {
                            value = libzapitu_rf_1.proto.Message.AppStateSyncKeyData.create(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, "creds");
        }
    };
};
exports.useMultiFileAuthState = useMultiFileAuthState;
