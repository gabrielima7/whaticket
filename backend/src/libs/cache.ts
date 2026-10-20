import Redis from "ioredis";
import { REDIS_URI_CONNECTION } from "../config/redis";
import util from "util";
import * as crypto from "crypto";

const redis = new Redis(REDIS_URI_CONNECTION);

function encryptParams(params: any) {
  const str = JSON.stringify(params);
  return crypto.createHash("sha256").update(str).digest("base64");
}

export function setFromParams(
  key: string,
  params: any,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const finalKey = `${key}:${encryptParams(params)}`;
  if (option !== undefined && optionValue !== undefined) {
    return set(finalKey, value, option, optionValue);
  }
  return set(finalKey, value);
}

export function getFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return get(finalKey);
}

export function delFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return del(finalKey);
}

export function set(
  key: string,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const setPromisefy = util.promisify(redis.set).bind(redis);
  if (option !== undefined && optionValue !== undefined) {
    return setPromisefy(key, value, option, optionValue);
  }

  return setPromisefy(key, value);
}

export function get(key: string) {
  const getPromisefy = util.promisify(redis.get).bind(redis);
  return getPromisefy(key);
}

export async function getKeys(pattern: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    });

    stream.on("data", (resultKeys: string[]) => {
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

export function del(key: string) {
  const delPromisefy = util.promisify(redis.del).bind(redis);
  return delPromisefy(key);
}

export async function delFromPattern(pattern: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    });

    stream.on("data", async (keys: string[]) => {
      if (keys && keys.length > 0) {
        stream.pause();
        try {
          // unlink é assíncrono/não-bloqueante no Redis
          await redis.unlink(...keys);
        } catch (err) {
          // Fallback para del se comando unlink não estiver disponível
          await redis.del(...keys);
        } finally {
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

export const cacheLayer = {
  set,
  setFromParams,
  get,
  getFromParams,
  getKeys,
  del,
  delFromParams,
  delFromPattern
};
