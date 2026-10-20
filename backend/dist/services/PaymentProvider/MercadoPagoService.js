"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentById = exports.createPixPayment = void 0;
const mercadopago_1 = require("mercadopago");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const ShowSettingsService_1 = __importDefault(require("../SettingServices/ShowSettingsService"));
const logger_1 = require("../../utils/logger");
const SUPER_ADMIN_COMPANY_ID = Number(process.env.SUPER_ADMIN_COMPANY_ID || 1);
const getAccessToken = async () => {
    const superAdminAccessTokenSetting = await (0, ShowSettingsService_1.default)({
        settingKey: "mercadoPagoAccessToken",
        companyId: SUPER_ADMIN_COMPANY_ID
    }).catch(() => null);
    const accessToken = superAdminAccessTokenSetting?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new AppError_1.default("Token de acesso do Mercado Pago não configurado.", 400);
    }
    return accessToken;
};
const getMercadoPagoClient = async () => {
    const accessToken = await getAccessToken();
    const config = new mercadopago_1.MercadoPagoConfig({ accessToken });
    return new mercadopago_1.Payment(config);
};
const createPixPayment = async ({ companyId, amount, description, invoiceId, payerEmail, payerFirstName, payerLastName, webhookUrl }) => {
    logger_1.logger.info({
        message: "MercadoPagoService.createPixPayment:init",
        companyId,
        amount,
        invoiceId,
        payerEmail,
        webhookUrl
    });
    const paymentClient = await getMercadoPagoClient();
    let payment;
    try {
        payment = await paymentClient.create({
            body: {
                transaction_amount: Number(amount),
                description,
                payment_method_id: "pix",
                notification_url: webhookUrl,
                external_reference: String(invoiceId),
                payer: {
                    email: payerEmail,
                    first_name: payerFirstName,
                    last_name: payerLastName
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error({
            message: "MercadoPagoService.createPixPayment:error",
            errorMessage: error?.message,
            errorResponse: error?.response ? JSON.stringify(error.response, null, 2) : undefined,
            errorCause: error
        });
        throw error;
    }
    const transactionData = payment.point_of_interaction?.transaction_data;
    if (!transactionData?.qr_code) {
        logger_1.logger.error({
            message: "MercadoPagoService.createPixPayment:missing_qr_code",
            paymentId: payment?.id,
            paymentStatus: payment?.status,
            paymentResponse: JSON.stringify(payment)
        });
        throw new AppError_1.default("Não foi possível gerar o PIX do Mercado Pago.", 500);
    }
    logger_1.logger.info({
        message: "MercadoPagoService.createPixPayment:success",
        paymentId: payment.id,
        status: payment.status
    });
    return {
        paymentId: String(payment.id),
        pixCopyPaste: transactionData.qr_code,
        qrCodeBase64: transactionData.qr_code_base64 || "",
        expiresAt: payment.date_of_expiration || undefined
    };
};
exports.createPixPayment = createPixPayment;
const getPaymentById = async (companyId, paymentId) => {
    const paymentClient = await getMercadoPagoClient();
    const payment = await paymentClient.get({ id: paymentId });
    return payment;
};
exports.getPaymentById = getPaymentById;
exports.default = {
    createPixPayment: exports.createPixPayment,
    getPaymentById: exports.getPaymentById
};
