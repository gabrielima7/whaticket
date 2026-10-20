"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testBirthdayReminder = void 0;
const BirthdayReminderService_1 = __importDefault(require("../services/BirthdayReminderService"));
const logger_1 = require("../utils/logger");
const testBirthdayReminder = async (req, res) => {
    try {
        logger_1.logger.info("Executando teste manual do serviço de aniversários");
        await (0, BirthdayReminderService_1.default)();
        return res.status(200).json({
            message: "Serviço de aniversários executado com sucesso. Verifique os logs para mais detalhes."
        });
    }
    catch (err) {
        logger_1.logger.error(`Erro ao executar serviço de aniversários: ${err}`);
        return res.status(500).json({
            error: "Erro ao executar serviço de aniversários",
            details: err instanceof Error ? err.message : String(err)
        });
    }
};
exports.testBirthdayReminder = testBirthdayReminder;
