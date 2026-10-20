"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addContactsUpdateJob = void 0;
const redis_1 = require("../../config/redis");
const bull_1 = __importDefault(require("bull"));
const configLoaderService_1 = __importDefault(require("../ConfigLoaderService/configLoaderService"));
const CreateOrUpdateBaileysService_1 = __importDefault(require("../BaileysServices/CreateOrUpdateBaileysService"));
const logger_1 = require("../../utils/logger");
const contactsUpdateQueue = new bull_1.default('contactsUpdateQueue', {
    redis: redis_1.REDIS_URI_CONNECTION,
    defaultJobOptions: {
        attempts: (0, configLoaderService_1.default)().webhook.attempts,
        backoff: {
            type: (0, configLoaderService_1.default)().webhook.backoff.type,
            delay: (0, configLoaderService_1.default)().webhook.backoff.delay, // Tempo em milissegundos antes de tentar novamente
        },
        removeOnFail: true,
        removeOnComplete: true, // Remove o job da fila quando completado com sucesso
    },
    limiter: {
        max: (0, configLoaderService_1.default)().webhook.limiter.max,
        duration: (0, configLoaderService_1.default)().webhook.limiter.duration, // Define a duração em milissegundos durante a qual o limite máximo é aplicado
    },
});
contactsUpdateQueue.process(async (job) => {
    const { whatsappId, contacts } = job.data;
    logger_1.logger.info('Inserindo contatos via Redis');
    await (0, CreateOrUpdateBaileysService_1.default)({ whatsappId, contacts });
});
const addContactsUpdateJob = async (whatsappId, contacts) => {
    await contactsUpdateQueue.add({ whatsappId, contacts });
};
exports.addContactsUpdateJob = addContactsUpdateJob;
