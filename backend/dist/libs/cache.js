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
exports.cacheLayer = exports.delFromPattern = exports.del = exports.getKeys = exports.get = exports.set = exports.delFromParams = exports.getFromParams = exports.setFromParams = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redis_1 = require("../config/redis");
const util_1 = __importDefault(require("util"));
const crypto = __importStar(require("crypto"));
const redis = new ioredis_1.default(redis_1.REDIS_URI_CONNECTION);
function encryptParams(params) {
    const str = JSON.stringify(params);
    return crypto.createHash("sha256").update(str).digest("base64");
}
function setFromParams(key, params, value, option, optionValue) {
    const finalKey = `${key}:${encryptParams(params)}`;
    if (option !== undefined && optionValue !== undefined) {
        return set(finalKey, value, option, optionValue);
    }
    return set(finalKey, value);
}
exports.setFromParams = setFromParams;
function getFromParams(key, params) {
    const finalKey = `${key}:${encryptParams(params)}`;
    return get(finalKey);
}
exports.getFromParams = getFromParams;
function delFromParams(key, params) {
    const finalKey = `${key}:${encryptParams(params)}`;
    return del(finalKey);
}
exports.delFromParams = delFromParams;
function set(key, value, option, optionValue) {
    const setPromisefy = util_1.default.promisify(redis.set).bind(redis);
    if (option !== undefined && optionValue !== undefined) {
        return setPromisefy(key, value, option, optionValue);
    }
    return setPromisefy(key, value);
}
exports.set = set;
function get(key) {
    const getPromisefy = util_1.default.promisify(redis.get).bind(redis);
    return getPromisefy(key);
}
exports.get = get;
async function getKeys(pattern) {
    return new Promise((resolve, reject) => {
        const keys = [];
        const stream = redis.scanStream({
            match: pattern,
            count: 100
        });
        stream.on("data", (resultKeys) => {
            for (let i = 0; i < resultKeys.length; i++) {
                keys.push(resultKeys[i]);
            }
        });
        stream.on("end", () => {
            resolve(keys);
        });
        stream.on("error", err => {
            reject(err);
        });
    });
}
exports.getKeys = getKeys;
function del(key) {
    const delPromisefy = util_1.default.promisify(redis.del).bind(redis);
    return delPromisefy(key);
}
exports.del = del;
async function delFromPattern(pattern) {
    return new Promise((resolve, reject) => {
        const stream = redis.scanStream({
            match: pattern,
            count: 100
        });
        stream.on("data", async (keys) => {
            if (keys && keys.length > 0) {
                stream.pause();
                try {
                    // unlink é assíncrono/não-bloqueante no Redis
                    await redis.unlink(...keys);
                }
                catch (err) {
                    // Fallback para del se comando unlink não estiver disponível
                    await redis.del(...keys);
                }
                finally {
                    stream.resume();
                }
            }
        });
        stream.on("end", () => {
            resolve();
        });
        stream.on("error", err => {
            reject(err);
        });
    });
}
exports.delFromPattern = delFromPattern;
exports.cacheLayer = {
    set,
    setFromParams,
    get,
    getFromParams,
    getKeys,
    del,
    delFromParams,
    delFromPattern
};
