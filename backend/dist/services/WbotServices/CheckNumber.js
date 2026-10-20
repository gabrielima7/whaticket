"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GetDefaultWhatsApp_1 = __importDefault(require("../../helpers/GetDefaultWhatsApp"));
const wbot_1 = require("../../libs/wbot");
const logger_1 = require("../../utils/logger");
const checker = async (number, wbot) => {
    const cleanNumber = `${number}`.replace(/\D/g, "").slice(0, 15);
    if (!cleanNumber) {
        throw new Error("ERR_INVALID_NUMBER");
    }
    const [validNumber] = await wbot.onWhatsApp(`${cleanNumber}@s.whatsapp.net`);
    logger_1.logger.info(validNumber);
    return validNumber;
};
const CheckContactNumber = async (number, companyId) => {
    const cleanNumber = `${number}`.replace(/\D/g, "").slice(0, 15);
    if (!cleanNumber) {
        throw new Error("ERR_INVALID_NUMBER");
    }
    const defaultWhatsapp = await (0, GetDefaultWhatsApp_1.default)(companyId);
    const wbot = (0, wbot_1.getWbot)(defaultWhatsapp.id);
    const isNumberExit = await checker(cleanNumber, wbot);
    if (!isNumberExit.exists) {
        throw new Error("ERR_CHECK_NUMBER");
    }
    return isNumberExit;
};
exports.default = CheckContactNumber;
