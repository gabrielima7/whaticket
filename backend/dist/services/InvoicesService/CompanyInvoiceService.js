"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renewCompanyAfterPayment = exports.ensureOpenInvoiceForCompany = exports.calculateNextDueDate = exports.getRecurrenceMonths = void 0;
const moment_1 = __importDefault(require("moment"));
const Invoices_1 = __importDefault(require("../../models/Invoices"));
const Plan_1 = __importDefault(require("../../models/Plan"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const RECURRENCE_MONTHS = {
    MENSAL: 1,
    TRIMESTRAL: 3,
    SEMESTRAL: 6,
    ANUAL: 12
};
const getRecurrenceMonths = (recurrence) => {
    return RECURRENCE_MONTHS[(recurrence || "MENSAL").toUpperCase()] || 1;
};
exports.getRecurrenceMonths = getRecurrenceMonths;
const calculateNextDueDate = (dueDate, recurrence) => {
    const baseDate = dueDate && (0, moment_1.default)(dueDate).isValid() ? (0, moment_1.default)(dueDate) : (0, moment_1.default)();
    const renewalBase = baseDate.isAfter((0, moment_1.default)()) ? baseDate : (0, moment_1.default)();
    return renewalBase
        .add((0, exports.getRecurrenceMonths)(recurrence), "months")
        .format("YYYY-MM-DD");
};
exports.calculateNextDueDate = calculateNextDueDate;
const ensureOpenInvoiceForCompany = async (company) => {
    if (!company.planId)
        return null;
    const plan = await Plan_1.default.findByPk(company.planId);
    if (!plan) {
        throw new AppError_1.default("Plano nao encontrado.", 404);
    }
    const dueDate = (0, moment_1.default)(company.dueDate || undefined).isValid()
        ? (0, moment_1.default)(company.dueDate).format("YYYY-MM-DD")
        : (0, moment_1.default)().format("YYYY-MM-DD");
    const openInvoices = await Invoices_1.default.findAll({
        where: {
            companyId: company.id,
            status: "open"
        },
        order: [["createdAt", "ASC"]]
    });
    const [openInvoice, ...extraInvoices] = openInvoices;
    await Promise.all(extraInvoices.map(invoice => invoice.update({ status: "cancelled" })));
    if (openInvoice) {
        await openInvoice.update({
            detail: plan.name,
            value: plan.value,
            dueDate
        });
        return openInvoice;
    }
    return Invoices_1.default.create({
        detail: plan.name,
        status: "open",
        value: plan.value,
        dueDate,
        companyId: company.id
    });
};
exports.ensureOpenInvoiceForCompany = ensureOpenInvoiceForCompany;
const renewCompanyAfterPayment = async (company, invoice) => {
    const nextDueDate = (0, exports.calculateNextDueDate)(company.dueDate, company.recurrence);
    await company.update({
        status: true,
        dueDate: nextDueDate
    });
    await invoice.update({
        status: "paid"
    });
    await company.reload();
    await (0, exports.ensureOpenInvoiceForCompany)(company);
    await company.reload();
    return company;
};
exports.renewCompanyAfterPayment = renewCompanyAfterPayment;
