"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bull_1 = __importDefault(require("bull"));
const connectionX = process.env.REDIS_URI || "";
const messageQueueSent = new bull_1.default('messageQueueSent', connectionX, {
    redis: {
        retryStrategy: (times) => {
            const delay = Math.min(times * 100, 5000);
            return delay;
        },
        maxRetriesPerRequest: null
    }
});
console.log(messageQueueSent);
exports.default = messageQueueSent;
