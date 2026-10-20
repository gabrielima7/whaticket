"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportContacts = void 0;
const lodash_1 = require("lodash");
const xlsx_1 = __importDefault(require("@e965/xlsx"));
const fs_1 = __importDefault(require("fs"));
const csv_1 = require("csv");
const Contact_1 = __importDefault(require("../../models/Contact"));
const CheckNumber_1 = __importDefault(require("../WbotServices/CheckNumber"));
const logger_1 = require("../../utils/logger");
async function ImportContacts(companyId, file) {
    const filePath = file?.path;
    const originalName = (file?.originalname || "").toLowerCase();
    const mapRowToContact = (row) => {
        let name = "";
        let number = "";
        let email = "";
        if ((0, lodash_1.has)(row, "nome") || (0, lodash_1.has)(row, "Nome")) {
            name = row["nome"] || row["Nome"];
        }
        if ((0, lodash_1.has)(row, "numero") ||
            (0, lodash_1.has)(row, "número") ||
            (0, lodash_1.has)(row, "Numero") ||
            (0, lodash_1.has)(row, "Número")) {
            number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
            // Suporta números de qualquer país (até 15 dígitos conforme padrão internacional)
            number = `${number}`.replace(/\D/g, "").slice(0, 15);
        }
        if ((0, lodash_1.has)(row, "email") ||
            (0, lodash_1.has)(row, "e-mail") ||
            (0, lodash_1.has)(row, "Email") ||
            (0, lodash_1.has)(row, "E-mail")) {
            email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
        }
        return { name, number, email, companyId };
    };
    let contactsRaw = [];
    // Suporte a CSV e a planilhas Excel (.xls, .xlsx)
    const isCsv = originalName.endsWith(".csv");
    if (isCsv) {
        let content = fs_1.default.readFileSync(filePath, "utf8");
        // Remove BOM UTF-8 se existir, para evitar erros "Invalid Opening Quote"
        if (content.charCodeAt(0) === 0xfeff) {
            content = content.slice(1);
        }
        await new Promise((resolve, reject) => {
            (0, csv_1.parse)(content, { columns: true, delimiter: content.includes(";") ? ";" : "," }, (err, records) => {
                if (err) {
                    return reject(err);
                }
                contactsRaw = records;
                resolve();
            });
        });
    }
    else {
        const workbook = xlsx_1.default.readFile(filePath);
        const worksheet = (0, lodash_1.head)(Object.values(workbook.Sheets));
        contactsRaw = xlsx_1.default.utils.sheet_to_json(worksheet, { header: 0 });
    }
    const contacts = contactsRaw.map(mapRowToContact);
    const contactList = [];
    for (const contact of contacts) {
        const [newContact, created] = await Contact_1.default.findOrCreate({
            where: {
                number: `${contact.number}`,
                companyId: contact.companyId
            },
            defaults: contact
        });
        if (created) {
            contactList.push(newContact);
        }
    }
    if (contactList) {
        for (let newContact of contactList) {
            try {
                const response = await (0, CheckNumber_1.default)(newContact.number, companyId);
                // Suporta números de qualquer país (até 15 dígitos conforme padrão internacional)
                const number = response.jid.replace(/\D/g, "").slice(0, 15);
                newContact.number = number;
                await newContact.save();
            }
            catch (e) {
                logger_1.logger.error(`Número de contato inválido: ${newContact.number}`);
            }
        }
    }
    // Remove arquivo temporário após o processamento
    if (filePath && fs_1.default.existsSync(filePath)) {
        fs_1.default.unlinkSync(filePath);
    }
    return contactList;
}
exports.ImportContacts = ImportContacts;
