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
const Sentry = __importStar(require("@sentry/node"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
require("express-async-errors");
require("reflect-metadata");
require("./bootstrap");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const uuid_1 = require("uuid");
const body_parser_1 = __importDefault(require("body-parser"));
const upload_1 = __importDefault(require("./config/upload"));
require("./database");
const AppError_1 = __importDefault(require("./errors/AppError"));
const queues_1 = require("./queues");
const routes_1 = __importDefault(require("./routes"));
const logger_1 = require("./utils/logger");
Sentry.init({ dsn: process.env.SENTRY_DSN });
const app = (0, express_1.default)();
app.set("trust proxy", "loopback");
app.use((req, res, next) => {
    req.id = (0, uuid_1.v4)();
    next();
});
app.set("queues", {
    messageQueue: queues_1.messageQueue,
    sendScheduledMessages: queues_1.sendScheduledMessages
});
app.use(body_parser_1.default.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "*"]
        }
    }
}));
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Muitas requisições deste IP, tente novamente após 15 minutos',
    skip: (req) => {
        return req.ip === '127.0.0.1' || req.ip === '::1';
    }
});
app.use('/auth', apiLimiter);
app.use((0, cors_1.default)({
    credentials: true,
    origin: (origin, callback) => {
        // Permite requisições sem origin (como webhooks do Gerencianet/MercadoPago)
        if (!origin) {
            return callback(null, true);
        }
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://api.gerencianet.com.br',
            'https://api.efipay.com.br',
            'https://api.mercadopago.com'
        ].filter(Boolean);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, true); // Permite todas as origens para webhooks
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-webhook-signature', 'X-Webhook-Signature', 'x-hub-signature', 'x-hub-signature-256', 'x-sgn', 'x-signature']
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use("/public", express_1.default.static(upload_1.default.directory));
app.use(routes_1.default);
Sentry.setupExpressErrorHandler(app);
app.use(async (err, req, res, _) => {
    if (err instanceof AppError_1.default) {
        logger_1.logger.warn(err);
        return res.status(err.statusCode).json({ error: err.message });
    }
    logger_1.logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
});
exports.default = app;
