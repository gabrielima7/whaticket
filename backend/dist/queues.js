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
exports.startQueueProcess = exports.randomValue = exports.parseToMilliseconds = exports.campaignQueue = exports.messageQueue = exports.schedulesRecorrenci = exports.sendScheduledMessages = exports.scheduleMonitor = exports.queueMonitor = exports.userMonitor = void 0;
const Sentry = __importStar(require("@sentry/node"));
const bull_1 = __importDefault(require("bull"));
const date_fns_1 = require("date-fns");
const lodash_1 = require("lodash");
const moment_1 = __importDefault(require("moment"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("./database"));
const GetWhatsappWbot_1 = __importDefault(require("./helpers/GetWhatsappWbot"));
const SendMessage_1 = require("./helpers/SendMessage");
const socket_1 = require("./libs/socket");
const GetWhatsAppSender_1 = require("./helpers/GetWhatsAppSender");
const Campaign_1 = __importDefault(require("./models/Campaign"));
const CampaignSetting_1 = __importDefault(require("./models/CampaignSetting"));
const CampaignShipping_1 = __importDefault(require("./models/CampaignShipping"));
const Company_1 = __importDefault(require("./models/Company"));
const Contact_1 = __importDefault(require("./models/Contact"));
const ContactList_1 = __importDefault(require("./models/ContactList"));
const ContactListItem_1 = __importDefault(require("./models/ContactListItem"));
const Schedule_1 = __importDefault(require("./models/Schedule"));
const User_1 = __importDefault(require("./models/User"));
const Whatsapp_1 = __importDefault(require("./models/Whatsapp"));
const ShowService_1 = __importDefault(require("./services/FileServices/ShowService"));
const SendWhatsAppMedia_1 = require("./services/WbotServices/SendWhatsAppMedia");
const wbotClosedTickets_1 = require("./services/WbotServices/wbotClosedTickets");
const FindOrCreateTicketService_1 = __importDefault(require("./services/TicketServices/FindOrCreateTicketService"));
const CompanyInvoiceService_1 = require("./services/InvoicesService/CompanyInvoiceService");
const fs = require('fs');
const mime = require('mime-types');
const chardet = require('chardet');
const logger_1 = require("./utils/logger");
const nodemailer = require('nodemailer');
const CronJob = require('cron').CronJob;
const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;
exports.userMonitor = new bull_1.default("UserMonitor", connection);
exports.queueMonitor = new bull_1.default("QueueMonitor", connection);
exports.scheduleMonitor = new bull_1.default("ScheduleMonitor", connection);
exports.sendScheduledMessages = new bull_1.default("SendSacheduledMessages", connection);
exports.schedulesRecorrenci = new bull_1.default("schedulesRecorrenci", connection);
exports.messageQueue = new bull_1.default("MessageQueue", connection, {
    limiter: {
        max: limiterMax,
        duration: limiterDuration
    }
});
exports.campaignQueue = new bull_1.default("CampaignQueue", connection);
async function handleSendMessage(job) {
    try {
        const { data } = job;
        const whatsapp = await Whatsapp_1.default.findByPk(data.whatsappId);
        if (whatsapp == null) {
            throw Error("Whatsapp não identificado");
        }
        const messageData = data.data;
        await (0, SendMessage_1.SendMessage)(whatsapp, messageData);
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.error("MessageQueue -> SendMessage: error", e.message);
        throw e;
    }
}
async function handleCloseTicketsAutomatic() {
    const job = new CronJob('*/1 * * * *', async () => {
        const companies = await Company_1.default.findAll();
        companies.map(async (c) => {
            try {
                const companyId = c.id;
                await (0, wbotClosedTickets_1.ClosedAllOpenTickets)(companyId);
            }
            catch (e) {
                Sentry.captureException(e);
                logger_1.logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
                throw e;
            }
        });
    });
    job.start();
}
async function handleSendMessageWbot(job) {
    try {
        const { data } = job;
        if (!data.messageData) {
            return;
        }
        //console.log(data);
        const { wbotId, number, text, options } = data.messageData;
        //console.log(wbotId);
        const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(Number(wbotId));
        const sentMessage = await sender.sendMessage(number, {
            text: text
        }, {
            ...options
        });
        //console.log(sentMessage);
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.error("MessageQueueWbot -> SendMessage: error", e.message);
        throw e;
    }
}
async function handleVerifySchedulesRecorrenci(job) {
    try {
        const { count, rows: schedules } = await Schedule_1.default.findAndCountAll({
            where: {
                status: "ENVIADA",
                repeatEvery: {
                    [sequelize_1.Op.not]: null,
                },
                selectDaysRecorrenci: {
                    [sequelize_1.Op.not]: '',
                },
            },
            include: [{ model: Contact_1.default, as: "contact" }]
        });
        if (count > 0) {
            schedules.map(async (schedule) => {
                if (schedule?.repeatCount === schedule?.repeatEvery) {
                    await schedule.update({
                        repeatEvery: null,
                        selectDaysRecorrenci: null
                    });
                }
                else {
                    await schedule.update({
                        sentAt: null
                    });
                }
                if (schedule?.repeatCount === schedule?.repeatEvery) {
                    await schedule.update({
                        repeatEvery: null,
                        selectDaysRecorrenci: null
                    });
                }
                else {
                    const newDateRecorrenci = await VerifyRecorrenciDate(schedule);
                }
            });
        }
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.error("SendScheduledMessage -> Verify: error", e.message);
        throw e;
    }
}
async function VerifyRecorrenciDate(schedule) {
    const { sendAt, selectDaysRecorrenci } = schedule;
    const originalDate = (0, moment_1.default)(sendAt);
    let dateFound = false;
    const diasSelecionados = selectDaysRecorrenci.split(', '); // Dias selecionados
    let i = 1;
    while (!dateFound) {
        let nextDate = (0, moment_1.default)(originalDate).add(i, "days");
        nextDate = nextDate.set({
            hour: originalDate.hours(),
            minute: originalDate.minutes(),
            second: originalDate.seconds(),
        });
        // Verifica se o dia da semana da próxima data está na lista de dias selecionados
        if (diasSelecionados.includes(nextDate.format('dddd'))) {
            // A data está dentro do período
            // Faça algo aqui se necessário
            let update = schedule?.repeatCount;
            update = update + 1;
            await schedule.update({
                status: 'PENDENTE',
                sendAt: nextDate.format("YYYY-MM-DD HH:mm:ssZ"),
                repeatCount: update,
            });
            logger_1.logger.info(`Recorrencia agendada para: ${schedule.contact.name}`);
            // Define a variável de controle para indicar que uma data foi encontrada
            dateFound = true;
        }
        i++;
    }
}
async function handleVerifySchedules(job) {
    try {
        const { count, rows: schedules } = await Schedule_1.default.findAndCountAll({
            where: {
                status: "PENDENTE",
                sentAt: null,
                sendAt: {
                    [sequelize_1.Op.gte]: (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"),
                    [sequelize_1.Op.lte]: (0, moment_1.default)().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
                }
            },
            include: [{ model: Contact_1.default, as: "contact" }]
        });
        if (count > 0) {
            schedules.map(async (schedule) => {
                await schedule.update({
                    status: "AGENDADA"
                });
                exports.sendScheduledMessages.add("SendMessage", { schedule }, { delay: 40000 });
                logger_1.logger.info(`Disparo agendado para: ${schedule.contact.name}`);
            });
        }
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.error("SendScheduledMessage -> Verify: error", e.message);
        throw e;
    }
}
async function handleSendScheduledMessage(job) {
    const { data: { schedule } } = job;
    let scheduleRecord = null;
    try {
        scheduleRecord = await Schedule_1.default.findByPk(schedule.id);
    }
    catch (e) {
        Sentry.captureException(e);
        logger_1.logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
    }
    try {
        const whatsapp = await Whatsapp_1.default.findByPk(schedule?.whatsappId);
        const queueId = schedule?.queueId;
        const prepareMediaMessage = async (schedule) => {
            const url = `public/company${schedule.companyId}/${schedule.mediaPath}`;
            const fileName = path_1.default.basename(url);
            const mimeType = mime.lookup(url);
            const buffer = fs.readFileSync(url);
            if (!buffer || buffer.length === 0) {
                throw new Error(`Buffer da mídia está vazio para o arquivo: ${url}`);
            }
            const fileType = mimeType.split('/')[0];
            const baseMessage = {
                caption: schedule.body || '',
                fileName: fileName,
                mimetype: mimeType
            };
            switch (fileType) {
                case 'image':
                    return { image: buffer, ...baseMessage };
                case 'video':
                    return { video: buffer, ...baseMessage };
                case 'audio':
                    return { audio: buffer, ptt: false, ...baseMessage };
                default:
                    return { document: buffer, ...baseMessage };
            }
        };
        if (schedule?.geral === true) {
            const ticket = await (0, FindOrCreateTicketService_1.default)(schedule.contact, schedule.whatsappId, 0, schedule.companyId, schedule.contact, true);
            if (queueId != null) {
                await ticket.update({
                    queueId,
                    whatsappId: schedule.whatsappId,
                    userId: schedule.userId ?? null,
                    isGroup: false,
                    status: schedule.userId ? "open" : "pending"
                });
            }
            else {
                await ticket.update({
                    whatsappId: schedule.whatsappId,
                    isGroup: false,
                    status: "pending"
                });
            }
            if (schedule?.mediaPath) {
                try {
                    const mediaMessage = await prepareMediaMessage(schedule);
                    const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(whatsapp.id);
                    await sender.sendMessage(`${ticket?.contact?.number}@s.whatsapp.net`, mediaMessage);
                }
                catch (mediaError) {
                    logger_1.logger.error(`Erro ao enviar mídia via ticket: ${mediaError}`);
                    throw mediaError;
                }
            }
            else {
                const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(whatsapp.id);
                await sender.sendMessage(`${ticket?.contact?.number}@s.whatsapp.net`, {
                    text: schedule?.body
                });
            }
        }
        else {
            const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(whatsapp.id);
            const contactNumber = schedule.contact.number;
            if (schedule?.mediaPath) {
                try {
                    const mediaMessage = await prepareMediaMessage(schedule);
                    await sender.sendMessage(`${contactNumber}@s.whatsapp.net`, mediaMessage);
                }
                catch (mediaError) {
                    logger_1.logger.error(`Erro ao enviar mídia diretamente: ${mediaError}`);
                    throw mediaError;
                }
            }
            else {
                await sender.sendMessage(`${contactNumber}@s.whatsapp.net`, {
                    text: schedule.body
                });
            }
        }
        await scheduleRecord?.update({
            sentAt: (0, moment_1.default)().format("YYYY-MM-DD HH:mm"),
            status: "ENVIADA"
        });
        logger_1.logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
        exports.sendScheduledMessages.clean(15000, "completed");
    }
    catch (err) {
        Sentry.captureException(err);
        await scheduleRecord?.update({
            status: "ERRO"
        });
        logger_1.logger.error("SendScheduledMessage -> SendMessage: error", err);
        throw err;
    }
}
async function handleVerifyCampaigns(job) {
    /**
     * Campanhas PROGRAMADA: pega as agendadas até 1h à frente E as que já passaram do horário (até 15 min atrás),
     * para não perder nenhuma se o cron atrasar ou rodar após o horário.
     */
    const campaigns = await database_1.default.query(`SELECT id, "scheduledAt" FROM "Campaigns"
       WHERE status = 'PROGRAMADA'
         AND "scheduledAt" <= now() + interval '1 hour'
         AND "scheduledAt" >= now() - interval '15 minutes'`, { type: sequelize_1.QueryTypes.SELECT });
    if (campaigns.length > 0)
        logger_1.logger.info(`Campanhas encontradas: ${campaigns.length}`);
    for (let campaign of campaigns) {
        try {
            const now = (0, moment_1.default)();
            const scheduledAt = (0, moment_1.default)(campaign.scheduledAt);
            const delayMs = Math.max(0, scheduledAt.diff(now, "milliseconds"));
            logger_1.logger.info(`Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delayMs}ms`);
            exports.campaignQueue.add("ProcessCampaign", { id: campaign.id }, {
                delay: delayMs,
                removeOnComplete: true
            });
        }
        catch (err) {
            Sentry.captureException(err);
        }
    }
}
async function getCampaign(id) {
    return await Campaign_1.default.findByPk(id, {
        include: [
            {
                model: ContactList_1.default,
                as: "contactList",
                attributes: ["id", "name"],
                include: [
                    {
                        model: ContactListItem_1.default,
                        as: "contacts",
                        attributes: ["id", "name", "number", "email", "isWhatsappValid"],
                        where: { isWhatsappValid: true }
                    }
                ]
            },
            {
                model: Whatsapp_1.default,
                as: "whatsapp",
                attributes: ["id", "name"]
            },
            {
                model: CampaignShipping_1.default,
                as: "shipping",
                include: [{ model: ContactListItem_1.default, as: "contact" }]
            }
        ]
    });
}
async function getContact(id) {
    return await ContactListItem_1.default.findByPk(id, {
        attributes: ["id", "name", "number", "email"]
    });
}
async function getSettings(campaign) {
    const settings = await CampaignSetting_1.default.findAll({
        where: { companyId: campaign.companyId },
        attributes: ["key", "value"]
    });
    let messageInterval = 20;
    let longerIntervalAfter = 20;
    let greaterInterval = 60;
    let variables = [];
    settings.forEach(setting => {
        if (setting.key === "messageInterval") {
            messageInterval = JSON.parse(setting.value);
        }
        if (setting.key === "longerIntervalAfter") {
            longerIntervalAfter = JSON.parse(setting.value);
        }
        if (setting.key === "greaterInterval") {
            greaterInterval = JSON.parse(setting.value);
        }
        if (setting.key === "variables") {
            variables = JSON.parse(setting.value);
        }
    });
    return {
        messageInterval,
        longerIntervalAfter,
        greaterInterval,
        variables
    };
}
function parseToMilliseconds(seconds) {
    return seconds * 1000;
}
exports.parseToMilliseconds = parseToMilliseconds;
async function sleep(seconds) {
    logger_1.logger.info(`Sleep de ${seconds} segundos iniciado: ${(0, moment_1.default)().format("HH:mm:ss")}`);
    return new Promise(resolve => {
        setTimeout(() => {
            logger_1.logger.info(`Sleep de ${seconds} segundos finalizado: ${(0, moment_1.default)().format("HH:mm:ss")}`);
            resolve(true);
        }, parseToMilliseconds(seconds));
    });
}
function getCampaignValidMessages(campaign) {
    const messages = [];
    if (!(0, lodash_1.isEmpty)(campaign.message1) && !(0, lodash_1.isNil)(campaign.message1)) {
        messages.push(campaign.message1);
    }
    if (!(0, lodash_1.isEmpty)(campaign.message2) && !(0, lodash_1.isNil)(campaign.message2)) {
        messages.push(campaign.message2);
    }
    if (!(0, lodash_1.isEmpty)(campaign.message3) && !(0, lodash_1.isNil)(campaign.message3)) {
        messages.push(campaign.message3);
    }
    if (!(0, lodash_1.isEmpty)(campaign.message4) && !(0, lodash_1.isNil)(campaign.message4)) {
        messages.push(campaign.message4);
    }
    if (!(0, lodash_1.isEmpty)(campaign.message5) && !(0, lodash_1.isNil)(campaign.message5)) {
        messages.push(campaign.message5);
    }
    return messages;
}
function getCampaignValidConfirmationMessages(campaign) {
    const messages = [];
    if (!(0, lodash_1.isEmpty)(campaign.confirmationMessage1) &&
        !(0, lodash_1.isNil)(campaign.confirmationMessage1)) {
        messages.push(campaign.confirmationMessage1);
    }
    if (!(0, lodash_1.isEmpty)(campaign.confirmationMessage2) &&
        !(0, lodash_1.isNil)(campaign.confirmationMessage2)) {
        messages.push(campaign.confirmationMessage2);
    }
    if (!(0, lodash_1.isEmpty)(campaign.confirmationMessage3) &&
        !(0, lodash_1.isNil)(campaign.confirmationMessage3)) {
        messages.push(campaign.confirmationMessage3);
    }
    if (!(0, lodash_1.isEmpty)(campaign.confirmationMessage4) &&
        !(0, lodash_1.isNil)(campaign.confirmationMessage4)) {
        messages.push(campaign.confirmationMessage4);
    }
    if (!(0, lodash_1.isEmpty)(campaign.confirmationMessage5) &&
        !(0, lodash_1.isNil)(campaign.confirmationMessage5)) {
        messages.push(campaign.confirmationMessage5);
    }
    return messages;
}
function getProcessedMessage(msg, variables, contact) {
    let finalMessage = msg;
    if (finalMessage.includes("{nome}")) {
        finalMessage = finalMessage.replace(/{nome}/g, contact.name);
    }
    if (finalMessage.includes("{email}")) {
        finalMessage = finalMessage.replace(/{email}/g, contact.email);
    }
    if (finalMessage.includes("{numero}")) {
        finalMessage = finalMessage.replace(/{numero}/g, contact.number);
    }
    variables.forEach(variable => {
        if (finalMessage.includes(`{${variable.key}}`)) {
            const regex = new RegExp(`{${variable.key}}`, "g");
            finalMessage = finalMessage.replace(regex, variable.value);
        }
    });
    return finalMessage;
}
function randomValue(min, max) {
    return Math.floor(Math.random() * max) + min;
}
exports.randomValue = randomValue;
async function verifyAndFinalizeCampaign(campaign) {
    const { contacts } = campaign.contactList;
    const count1 = contacts.length;
    const count2 = await CampaignShipping_1.default.count({
        where: {
            campaignId: campaign.id,
            deliveredAt: {
                [sequelize_1.Op.not]: null
            }
        }
    });
    if (count1 === count2) {
        await campaign.update({ status: "FINALIZADA", completedAt: (0, moment_1.default)() });
    }
    const io = (0, socket_1.getIO)();
    io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
        action: "update",
        record: campaign
    });
}
/**
 * Calcula delay em ms para o job: tempo até baseDelay + intervalo entre mensagens.
 * longerIntervalAfter = número de contatos após o qual usar greaterInterval (segundos).
 * greaterInterval, messageInterval = segundos entre disparos.
 */
function calculateDelay(index, baseDelay, longerIntervalAfterCount, greaterIntervalSec, messageIntervalSec) {
    const diffMs = (0, date_fns_1.differenceInSeconds)(baseDelay, new Date()) * 1000;
    const intervalSec = index > longerIntervalAfterCount ? greaterIntervalSec : messageIntervalSec;
    return Math.max(0, diffMs) + intervalSec * 1000;
}
async function handleProcessCampaign(job) {
    try {
        const { id } = job.data;
        const campaign = await getCampaign(id);
        if (!campaign) {
            logger_1.logger.warn(`handleProcessCampaign: campanha ${id} não encontrada`);
            return;
        }
        const settings = await getSettings(campaign);
        const contactList = campaign.contactList;
        if (!contactList) {
            logger_1.logger.warn(`handleProcessCampaign: campanha ${id} sem lista de contatos`);
            return;
        }
        const contacts = contactList.contacts;
        if (!(0, lodash_1.isArray)(contacts) || contacts.length === 0) {
            logger_1.logger.warn(`handleProcessCampaign: campanha ${id} sem contatos válidos (isWhatsappValid)`);
            return;
        }
        const contactData = contacts.map(contact => ({
            contactId: contact.id,
            campaignId: campaign.id,
            variables: settings.variables,
        }));
        // longerIntervalAfter = após quantos CONTATOS usar intervalo maior (em segundos no settings)
        const longerIntervalAfterCount = Math.max(0, Number(settings.longerIntervalAfter) || 20);
        const messageIntervalSec = settings.messageInterval;
        let baseDelay = new Date(campaign.scheduledAt);
        const queuePromises = [];
        for (let i = 0; i < contactData.length; i++) {
            const useGreaterInterval = i > longerIntervalAfterCount;
            const intervalSec = useGreaterInterval ? settings.greaterInterval : messageIntervalSec;
            baseDelay = (0, date_fns_1.addSeconds)(baseDelay, intervalSec);
            const { contactId, campaignId, variables } = contactData[i];
            const delay = calculateDelay(i, baseDelay, longerIntervalAfterCount, settings.greaterInterval, messageIntervalSec);
            const queuePromise = exports.campaignQueue.add("PrepareContact", { contactId, campaignId, variables, delay }, { removeOnComplete: true });
            queuePromises.push(queuePromise);
            logger_1.logger.info(`Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`);
        }
        await Promise.all(queuePromises);
        await campaign.update({ status: "EM_ANDAMENTO" });
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(`handleProcessCampaign error: ${err?.message}`, err);
    }
}
let ultima_msg = 0;
async function handlePrepareContact(job) {
    try {
        const { contactId, campaignId, delay, variables } = job.data;
        const campaign = await getCampaign(campaignId);
        const contact = await getContact(contactId);
        const campaignShipping = {};
        campaignShipping.number = contact.number;
        campaignShipping.contactId = contactId;
        campaignShipping.campaignId = campaignId;
        const messages = getCampaignValidMessages(campaign);
        if (messages.length) {
            const radomIndex = ultima_msg;
            console.log('ultima_msg:', ultima_msg);
            ultima_msg++;
            if (ultima_msg >= messages.length) {
                ultima_msg = 0;
            }
            const message = getProcessedMessage(messages[radomIndex], variables, contact);
            campaignShipping.message = `\u200c ${message}`;
        }
        if (campaign.confirmation) {
            const confirmationMessages = getCampaignValidConfirmationMessages(campaign);
            if (confirmationMessages.length) {
                const radomIndex = randomValue(0, confirmationMessages.length);
                const message = getProcessedMessage(confirmationMessages[radomIndex], variables, contact);
                campaignShipping.confirmationMessage = `\u200c ${message}`;
            }
        }
        const [record, created] = await CampaignShipping_1.default.findOrCreate({
            where: {
                campaignId: campaignShipping.campaignId,
                contactId: campaignShipping.contactId
            },
            defaults: campaignShipping
        });
        if (!created &&
            record.deliveredAt === null &&
            record.confirmationRequestedAt === null) {
            record.set(campaignShipping);
            await record.save();
        }
        if (record.deliveredAt === null &&
            record.confirmationRequestedAt === null) {
            const nextJob = await exports.campaignQueue.add("DispatchCampaign", {
                campaignId: campaign.id,
                campaignShippingId: record.id,
                contactListItemId: contactId
            }, {
                delay
            });
            await record.update({ jobId: String(nextJob.id) });
        }
        await verifyAndFinalizeCampaign(campaign);
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
    }
}
async function handleDispatchCampaign(job) {
    try {
        const { data } = job;
        const { campaignShippingId, campaignId } = data;
        const campaign = await getCampaign(campaignId);
        const wbot = await (0, GetWhatsappWbot_1.default)(campaign.whatsapp);
        if (!wbot) {
            logger_1.logger.error(`campaignQueue -> DispatchCampaign -> error: wbot not found`);
            return;
        }
        if (!campaign.whatsapp) {
            logger_1.logger.error(`campaignQueue -> DispatchCampaign -> error: whatsapp not found`);
            return;
        }
        if (!wbot?.user?.id) {
            logger_1.logger.error(`campaignQueue -> DispatchCampaign -> error: wbot user not found`);
            return;
        }
        logger_1.logger.info(`Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}`);
        const campaignShipping = await CampaignShipping_1.default.findByPk(campaignShippingId, {
            include: [{ model: ContactListItem_1.default, as: "contact" }]
        });
        const chatId = `${campaignShipping.number}@s.whatsapp.net`;
        if (campaign.confirmation && campaignShipping.confirmation === null) {
            await wbot.sendMessage(chatId, {
                text: campaignShipping.confirmationMessage
            });
            await campaignShipping.update({ confirmationRequestedAt: (0, moment_1.default)() });
        }
        else {
            await wbot.sendMessage(chatId, {
                text: campaignShipping.message
            });
            if (!(0, lodash_1.isNil)(campaign.fileListId)) {
                try {
                    const publicFolder = path_1.default.resolve(__dirname, "..", "public", `company${campaign.companyId}`);
                    const files = await (0, ShowService_1.default)(campaign.fileListId, campaign.companyId);
                    const folder = path_1.default.resolve(publicFolder, "fileList", String(files.id));
                    for (const [index, file] of files.options.entries()) {
                        const options = await (0, SendWhatsAppMedia_1.getMessageOptions)(file.path, path_1.default.resolve(folder, file.path), file.name);
                        await wbot.sendMessage(chatId, { ...options });
                    }
                }
                finally {
                    // Caso precise executar alguma ação independentemente de erro
                }
            }
            if (campaign.mediaPath) {
                //const filePath = path.resolve("public", campaign.mediaPath);
                const filePath = path_1.default.resolve(`public/company${campaign.companyId}`, campaign.mediaPath);
                //const options = await getMessageOptions(campaign.mediaName, filePath);
                const options = await (0, SendWhatsAppMedia_1.getMessageOptions)(campaign.mediaName, filePath);
                if (Object.keys(options).length) {
                    await wbot.sendMessage(chatId, { ...options });
                }
            }
            await campaignShipping.update({ deliveredAt: (0, moment_1.default)() });
        }
        await verifyAndFinalizeCampaign(campaign);
        const io = (0, socket_1.getIO)();
        io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
            action: "update",
            record: campaign
        });
        logger_1.logger.info(`Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact.name}`);
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(err.message);
        console.log(err.stack);
    }
}
async function handleLoginStatus(job) {
    const users = await database_1.default.query(`select id from "Users" where "updatedAt" < now() - '5 minutes'::interval and online = true`, { type: sequelize_1.QueryTypes.SELECT });
    for (let item of users) {
        try {
            const user = await User_1.default.findByPk(item.id);
            await user.update({ online: false });
            logger_1.logger.info(`Usuário passado para offline: ${item.id}`);
        }
        catch (e) {
            Sentry.captureException(e);
        }
    }
}
async function handleInvoiceCreate() {
    logger_1.logger.info("GERENDO RECEITA...");
    const job = new CronJob('*/1 * * * *', async () => {
        const companies = await Company_1.default.findAll();
        companies.map(async (c) => {
            const status = c.status;
            const dueDate = c.dueDate;
            const date = (0, moment_1.default)(dueDate).format();
            const timestamp = (0, moment_1.default)().format();
            const hoje = (0, moment_1.default)().format("DD/MM/yyyy");
            const vencimento = (0, moment_1.default)(dueDate).format("DD/MM/yyyy");
            const diff = (0, moment_1.default)(vencimento, "DD/MM/yyyy").diff((0, moment_1.default)(hoje, "DD/MM/yyyy"));
            const dias = moment_1.default.duration(diff).asDays();
            if (status === true) {
                //logger.info(`EMPRESA: ${c.id} está ATIVA com vencimento em: ${vencimento} | ${dias}`);
                //Verifico se a empresa está a mais de 10 dias sem pagamento
                if (dias <= -3) {
                    logger_1.logger.info(`EMPRESA: ${c.id} está VENCIDA A MAIS DE 3 DIAS... INATIVANDO... ${dias}`);
                    c.status = false;
                    await c.save(); // Save the updated company record
                    logger_1.logger.info(`EMPRESA: ${c.id} foi INATIVADA.`);
                    logger_1.logger.info(`EMPRESA: ${c.id} Desativando conexões com o WhatsApp...`);
                    try {
                        const whatsapps = await Whatsapp_1.default.findAll({
                            where: {
                                companyId: c.id,
                            },
                            attributes: ['id', 'status', 'session'],
                        });
                        for (const whatsapp of whatsapps) {
                            if (whatsapp.session) {
                                await whatsapp.update({ status: "DISCONNECTED", session: "" });
                                try {
                                    const sender = await (0, GetWhatsAppSender_1.getWhatsAppSenderByWhatsappId)(whatsapp.id);
                                    if (sender.logout)
                                        await sender.logout();
                                }
                                catch (e) {
                                    logger_1.logger.warn(`Logout conexão ${whatsapp.id} falhou:`, e);
                                }
                                logger_1.logger.info(`EMPRESA: ${c.id} teve o WhatsApp ${whatsapp.id} desconectado...`);
                            }
                        }
                    }
                    catch (error) {
                        // Lidar com erros, se houver
                        console.error('Erro ao buscar os IDs de WhatsApp:', error);
                        throw error;
                    }
                }
                else { // ELSE if(dias <= -3){
                    const invoice = await (0, CompanyInvoiceService_1.ensureOpenInvoiceForCompany)(c);
                    if (invoice) {
                        logger_1.logger.info(`Fatura aberta sincronizada para o cliente: ${c.id}`);
                    }
                } // if(dias <= -6){
            }
            else { // ELSE if(status === true){
                //logger.info(`EMPRESA: ${c.id} está INATIVA`);
            }
        });
    });
    job.start();
}
handleCloseTicketsAutomatic();
handleInvoiceCreate();
async function startQueueProcess() {
    logger_1.logger.info("Iniciando processamento de filas");
    exports.messageQueue.process("SendMessage", handleSendMessage);
    exports.scheduleMonitor.process("Verify", handleVerifySchedules);
    exports.schedulesRecorrenci.process("VerifyRecorrenci", handleVerifySchedulesRecorrenci);
    exports.sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);
    exports.campaignQueue.process("VerifyCampaigns", handleVerifyCampaigns);
    exports.campaignQueue.process("ProcessCampaign", handleProcessCampaign);
    exports.campaignQueue.process("PrepareContact", handlePrepareContact);
    exports.campaignQueue.process("DispatchCampaign", handleDispatchCampaign);
    exports.userMonitor.process("VerifyLoginStatus", handleLoginStatus);
    //queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);
    exports.scheduleMonitor.add("Verify", {}, {
        repeat: { cron: "*/30 * * * * *" },
        removeOnComplete: true
    });
    exports.campaignQueue.add("VerifyCampaigns", {}, {
        repeat: { cron: "*/5 * * * *", key: "verify-campaing" },
        removeOnComplete: true
    });
    exports.userMonitor.add("VerifyLoginStatus", {}, {
        repeat: { cron: "*/5 * * * *", key: "verify-login" },
        removeOnComplete: true
    });
    exports.queueMonitor.add("VerifyQueueStatus", {}, {
        repeat: { cron: "*/20 * * * * *" },
        removeOnComplete: true
    });
}
exports.startQueueProcess = startQueueProcess;
