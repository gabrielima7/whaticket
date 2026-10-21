"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const Baileys_1 = __importDefault(require("../../models/Baileys"));
const createOrUpdateBaileysService = async ({ whatsappId, contacts }) => {
    const baileysExists = await Baileys_1.default.findOne({
        where: { whatsappId }
    });
    if (!contacts) {
        return baileysExists;
    }
    const contactMap = new Map();
    if (baileysExists) {
        const baileysContacts = baileysExists.contacts
            ? JSON.parse(baileysExists.contacts)
            : [];
        if ((0, lodash_1.isArray)(baileysContacts)) {
            for (const c of baileysContacts) {
                if (c?.id) {
                    contactMap.set(c.id, c);
                }
            }
        }
        if ((0, lodash_1.isArray)(contacts)) {
            for (const c of contacts) {
                if (c?.id) {
                    const existing = contactMap.get(c.id);
                    contactMap.set(c.id, { ...(existing || {}), ...c });
                }
            }
        }
        const uniqueContacts = Array.from(contactMap.values());
        const newBaileys = await baileysExists.update({
            contacts: JSON.stringify(uniqueContacts)
        });
        return newBaileys;
    }
    if ((0, lodash_1.isArray)(contacts)) {
        for (const c of contacts) {
            if (c?.id) {
                contactMap.set(c.id, c);
            }
        }
    }
    const baileys = await Baileys_1.default.create({
        whatsappId,
        contacts: JSON.stringify(Array.from(contactMap.values()))
    });
    return baileys;
};
exports.default = createOrUpdateBaileysService;
