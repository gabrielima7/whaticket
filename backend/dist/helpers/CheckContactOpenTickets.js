"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const Ticket_1 = __importDefault(require("../models/Ticket"));
const CheckContactOpenTickets = async (contactId, whatsappId, companyId) => {
    let ticket;
    const whereClause = {
        contactId,
        status: { [sequelize_1.Op.or]: ["open", "pending"] },
    };
    if (companyId) {
        whereClause.companyId = companyId;
    }
    if (whatsappId) {
        whereClause.whatsappId = whatsappId;
    }
    ticket = await Ticket_1.default.findOne({
        where: whereClause,
        include: [
            {
                association: "user",
                attributes: ["id", "name", "email"]
            }
        ]
    });
    return ticket;
};
exports.default = CheckContactOpenTickets;
