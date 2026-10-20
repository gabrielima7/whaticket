"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMsgAckJob = void 0;
const redis_1 = require("../../config/redis");
const bull_1 = __importDefault(require("bull"));
const wbotMessageListener_1 = require("./wbotMessageListener");
const configLoaderService_1 = __importDefault(require("../ConfigLoaderService/configLoaderService"));
const msgAckQueue = new bull_1.default('msgAckQueue', {
    redis: redis_1.REDIS_URI_CONNECTION,
    defaultJobOptions: {
        attempts: (0, configLoaderService_1.default)().webhook.attempts,
        backoff: {
            type: (0, configLoaderService_1.default)().webhook.backoff.type,
            delay: (0, configLoaderService_1.default)().webhook.backoff.delay,
        },
        removeOnFail: true,
        removeOnComplete: true,
    },
    limiter: {
        max: (0, configLoaderService_1.default)().webhook.limiter.max,
        duration: (0, configLoaderService_1.default)().webhook.limiter.duration,
    },
});
msgAckQueue.process(async (job) => {
    const { msg, chat } = job.data;
    try {
        await (0, wbotMessageListener_1.handleMsgAck)(msg, chat);
        // Remover o job após um atraso de 5 segundos
        setTimeout(() => {
            job.remove()
                .then(() => {
                //console.log(`Job ${job.id} removido com sucesso após conclusão.`);
            })
                .catch(err => {
                //console.log(`Erro ao remover job ${job.id}: ${err}`);
            });
        }, 5000);
    }
    catch (error) {
        //console.error('Erro ao processar o job:', error);
        // Você também pode remover o job em caso de erro, caso deseje
        // await job.remove();
    }
});
const addMsgAckJob = async (msg, chat) => {
    await msgAckQueue.add({ msg, chat });
};
exports.addMsgAckJob = addMsgAckJob;
