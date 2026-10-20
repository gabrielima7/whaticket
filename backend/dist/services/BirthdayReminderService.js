"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const moment_1 = __importDefault(require("moment"));
const Contact_1 = __importDefault(require("../models/Contact"));
const Setting_1 = __importDefault(require("../models/Setting"));
const Company_1 = __importDefault(require("../models/Company"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const Ticket_1 = __importDefault(require("../models/Ticket"));
const Message_1 = __importDefault(require("../models/Message"));
const logger_1 = require("../utils/logger");
const SendWhatsAppMessage_1 = __importDefault(require("./WbotServices/SendWhatsAppMessage"));
const FindOrCreateTicketService_1 = __importDefault(require("./TicketServices/FindOrCreateTicketService"));
const Mustache_1 = __importDefault(require("../helpers/Mustache"));
const wbot_1 = require("../libs/wbot");
const BirthdayReminderService = async () => {
    try {
        logger_1.logger.info(`🎂 Iniciando verificação de aniversários - ${(0, moment_1.default)().format("DD/MM/YYYY HH:mm:ss")}`);
        // Busca todas as empresas
        const companies = await Company_1.default.findAll({
            attributes: ["id"]
        });
        logger_1.logger.info(`Encontradas ${companies.length} empresa(s) para verificar`);
        for (const company of companies) {
            try {
                // Verifica se o aviso de aniversariantes está habilitado
                const birthdayReminderSetting = await Setting_1.default.findOne({
                    where: {
                        key: "birthdayReminderEnabled",
                        companyId: company.id,
                        value: "enabled"
                    }
                });
                if (!birthdayReminderSetting) {
                    continue; // Pula para a próxima empresa se não estiver habilitado
                }
                // Busca o horário de disparo configurado
                const birthdayReminderTimeSetting = await Setting_1.default.findOne({
                    where: {
                        key: "birthdayReminderTime",
                        companyId: company.id
                    }
                });
                const reminderTime = String(birthdayReminderTimeSetting?.value || "09:00");
                const timeParts = reminderTime.split(":");
                const reminderHour = parseInt(timeParts[0] || "9", 10);
                const reminderMinute = parseInt(timeParts[1] || "0", 10);
                const now = (0, moment_1.default)();
                const currentHour = now.hour();
                const currentMinute = now.minute();
                // Verifica se é o horário configurado (verifica se é exatamente o horário ou até 1 minuto depois)
                const currentTimeInMinutes = currentHour * 60 + currentMinute;
                const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
                const timeDiff = currentTimeInMinutes - reminderTimeInMinutes;
                // Só executa se estiver no horário exato ou até 1 minuto depois (para garantir que não perca)
                if (timeDiff < 0 || timeDiff > 1) {
                    // Não é o horário configurado ainda, ou já passou mais de 1 minuto
                    continue;
                }
                logger_1.logger.info(`✅ Horário de disparo atingido para empresa ${company.id}: ${reminderTime} (atual: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')})`);
                // Busca a mensagem de aniversário
                const birthdayMessageSetting = await Setting_1.default.findOne({
                    where: {
                        key: "birthdayMessage",
                        companyId: company.id
                    }
                });
                if (!birthdayMessageSetting || !birthdayMessageSetting.value) {
                    continue; // Pula se não houver mensagem configurada
                }
                const birthdayMessage = birthdayMessageSetting.value;
                logger_1.logger.info(`Verificando aniversários para empresa ${company.id} - Horário configurado: ${reminderTime}, Horário atual: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
                // Busca o WhatsApp padrão da empresa
                const whatsapp = await Whatsapp_1.default.findOne({
                    where: {
                        companyId: company.id,
                        isDefault: true,
                        status: "CONNECTED"
                    }
                });
                if (!whatsapp) {
                    continue; // Pula se não houver WhatsApp conectado
                }
                // Busca a sessão do WhatsApp
                let wbot;
                try {
                    wbot = (0, wbot_1.getWbot)(whatsapp.id);
                    logger_1.logger.info(`Sessão do WhatsApp ${whatsapp.id} encontrada para empresa ${company.id}`);
                }
                catch (err) {
                    logger_1.logger.error(`Erro ao obter sessão do WhatsApp ${whatsapp.id}: ${err}`);
                    continue; // Pula se não houver sessão ativa
                }
                if (!wbot) {
                    logger_1.logger.warn(`Sessão do WhatsApp ${whatsapp.id} não encontrada para empresa ${company.id}`);
                    continue; // Pula se não houver sessão ativa
                }
                // Data de hoje no formato YYYY-MM-DD (usando timezone local para comparar com data salva)
                const today = (0, moment_1.default)().format("YYYY-MM-DD");
                const todayMonthDay = (0, moment_1.default)().format("MM-DD");
                logger_1.logger.info(`Verificando aniversários para empresa ${company.id} - Data de hoje: ${today} (${todayMonthDay})`);
                // Busca contatos com aniversário hoje
                const contacts = await Contact_1.default.findAll({
                    where: {
                        companyId: company.id,
                        birthday: {
                            [sequelize_1.Op.not]: null
                        },
                        active: true,
                        isGroup: false
                    }
                });
                logger_1.logger.info(`Encontrados ${contacts.length} contato(s) com aniversário cadastrado para empresa ${company.id}`);
                for (const contact of contacts) {
                    try {
                        if (!contact.birthday) {
                            continue;
                        }
                        // Extrai mês e dia da data de aniversário
                        // O birthday pode vir como Date, string (YYYY-MM-DD), ou outro formato
                        const birthdayValue = contact.getDataValue('birthday');
                        let contactMonth;
                        let contactDay;
                        // Primeiro, tenta extrair diretamente da string se for formato YYYY-MM-DD
                        if (typeof birthdayValue === 'string') {
                            const birthdayStr = String(birthdayValue).trim();
                            // Remove qualquer parte de hora se existir (YYYY-MM-DD HH:mm:ss)
                            const dateOnly = birthdayStr.split(' ')[0];
                            if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
                                // Formato YYYY-MM-DD - extrai diretamente (mais confiável)
                                const dateParts = dateOnly.split('-');
                                contactMonth = dateParts[1];
                                contactDay = dateParts[2];
                                logger_1.logger.info(`✅ Extraído diretamente da string: ${contactMonth}-${contactDay} de ${dateOnly}`);
                            }
                            else {
                                // Tenta converter para Date e extrair
                                const birthdayDate = new Date(birthdayStr);
                                if (!isNaN(birthdayDate.getTime())) {
                                    contactMonth = String(birthdayDate.getMonth() + 1).padStart(2, '0');
                                    contactDay = String(birthdayDate.getDate()).padStart(2, '0');
                                    logger_1.logger.info(`Extraído de Date convertido: ${contactMonth}-${contactDay} de ${birthdayStr}`);
                                }
                                else {
                                    logger_1.logger.error(`❌ Data inválida para ${contact.name}: ${birthdayStr}`);
                                    continue;
                                }
                            }
                        }
                        else if (birthdayValue instanceof Date) {
                            // Se é Date, extrai mês e dia usando métodos locais (não UTC)
                            contactMonth = String(birthdayValue.getMonth() + 1).padStart(2, '0');
                            contactDay = String(birthdayValue.getDate()).padStart(2, '0');
                            logger_1.logger.info(`Extraído de Date: ${contactMonth}-${contactDay}`);
                        }
                        else if (birthdayValue) {
                            // Tenta converter para Date
                            const birthdayDate = new Date(birthdayValue);
                            if (!isNaN(birthdayDate.getTime())) {
                                contactMonth = String(birthdayDate.getMonth() + 1).padStart(2, '0');
                                contactDay = String(birthdayDate.getDate()).padStart(2, '0');
                                logger_1.logger.info(`Extraído de Date (fallback): ${contactMonth}-${contactDay}`);
                            }
                            else {
                                logger_1.logger.error(`❌ Data inválida para ${contact.name}: ${birthdayValue}`);
                                continue;
                            }
                        }
                        else {
                            logger_1.logger.error(`❌ Sem data de aniversário para ${contact.name}`);
                            continue;
                        }
                        const contactMonthDay = `${contactMonth}-${contactDay}`;
                        logger_1.logger.info(`🔍 Verificando aniversário: Contato ${contact.name} (ID: ${contact.id}) - Data salva: ${contact.birthday} (tipo: ${typeof birthdayValue}, valor bruto: ${birthdayValue}) - Mês/Dia extraído: ${contactMonthDay} - Hoje: ${todayMonthDay}`);
                        if (contactMonthDay !== todayMonthDay) {
                            logger_1.logger.info(`❌ Não é aniversário hoje para ${contact.name}: ${contactMonthDay} !== ${todayMonthDay}`);
                            continue; // Não é aniversário hoje
                        }
                        logger_1.logger.info(`✅✅✅ ANIVERSÁRIO DETECTADO para ${contact.name}! (${contactMonthDay} === ${todayMonthDay}) Enviando mensagem...`);
                        // Verifica se já foi enviada mensagem de aniversário hoje
                        const todayStart = (0, moment_1.default)().startOf("day").toDate();
                        const todayEnd = (0, moment_1.default)().endOf("day").toDate();
                        const existingTicket = await Ticket_1.default.findOne({
                            where: {
                                contactId: contact.id,
                                companyId: company.id
                            }
                        });
                        if (existingTicket) {
                            // Verifica se já existe mensagem de aniversário enviada hoje
                            const existingMessage = await Message_1.default.findOne({
                                where: {
                                    ticketId: existingTicket.id,
                                    fromMe: true,
                                    createdAt: {
                                        [sequelize_1.Op.gte]: todayStart,
                                        [sequelize_1.Op.lte]: todayEnd
                                    }
                                },
                                order: [["createdAt", "DESC"]]
                            });
                            // Se já existe mensagem enviada hoje, verifica se é de aniversário
                            if (existingMessage) {
                                // Verifica se a mensagem contém parte da mensagem de aniversário configurada
                                const messagePreview = birthdayMessage.substring(0, 30).toLowerCase();
                                const existingBody = existingMessage.body?.toLowerCase() || "";
                                if (existingBody.includes(messagePreview) || existingBody.includes("aniversário") || existingBody.includes("aniversario") || existingBody.includes("parabéns") || existingBody.includes("parabens")) {
                                    logger_1.logger.info(`⏭️ Mensagem de aniversário já enviada hoje para ${contact.name}, pulando...`);
                                    continue; // Já foi enviada mensagem de aniversário hoje
                                }
                            }
                        }
                        // Calcula a idade - precisa da data completa para calcular
                        let birthdayDateForAge;
                        if (typeof birthdayValue === 'string') {
                            const birthdayStr = String(birthdayValue).trim().split(' ')[0];
                            if (/^\d{4}-\d{2}-\d{2}$/.test(birthdayStr)) {
                                const dateParts = birthdayStr.split('-');
                                const year = parseInt(dateParts[0], 10);
                                const month = parseInt(dateParts[1], 10);
                                const day = parseInt(dateParts[2], 10);
                                birthdayDateForAge = new Date(year, month - 1, day);
                            }
                            else {
                                birthdayDateForAge = new Date(birthdayStr);
                            }
                        }
                        else if (birthdayValue instanceof Date) {
                            birthdayDateForAge = birthdayValue;
                        }
                        else {
                            birthdayDateForAge = new Date(birthdayValue);
                        }
                        const age = (0, moment_1.default)().diff((0, moment_1.default)(birthdayDateForAge), "years");
                        logger_1.logger.info(`Idade calculada para ${contact.name}: ${age} anos`);
                        // Substitui variáveis na mensagem
                        let finalMessage = birthdayMessage;
                        finalMessage = finalMessage.replace(/\{\{name\}\}/g, contact.name || "Cliente");
                        finalMessage = finalMessage.replace(/\{\{idade\}\}/g, age.toString());
                        // Busca ou cria ticket para o contato
                        const ticket = await (0, FindOrCreateTicketService_1.default)(contact, whatsapp.id, 0, company.id);
                        // Envia a mensagem
                        await (0, SendWhatsAppMessage_1.default)({
                            body: (0, Mustache_1.default)(finalMessage, contact),
                            ticket
                        });
                        logger_1.logger.info(`Mensagem de aniversário enviada para ${contact.name} (${contact.number}) - Empresa ${company.id}`);
                    }
                    catch (err) {
                        logger_1.logger.error(`Erro ao enviar mensagem de aniversário para contato ${contact.id}: ${err}`);
                    }
                }
            }
            catch (err) {
                logger_1.logger.error(`Erro ao processar aniversários para empresa ${company.id}: ${err}`);
            }
        }
    }
    catch (err) {
        logger_1.logger.error(`Erro no serviço de aniversários: ${err}`);
    }
};
exports.default = BirthdayReminderService;
