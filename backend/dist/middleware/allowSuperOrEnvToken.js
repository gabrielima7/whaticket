"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = require("jsonwebtoken");
const auth_1 = __importDefault(require("../config/auth"));
const User_1 = __importDefault(require("../models/User"));
const envTokenAuth_1 = __importDefault(require("./envTokenAuth"));
const allowSuperOrEnvToken = async (req, res, next) => {
    if (req.user) {
        const user = await User_1.default.findByPk(req.user.id);
        if (user && (user.super || user.profile === "admin")) {
            return next();
        }
    }
    const authHeader = req.headers.authorization;
    if (authHeader) {
        try {
            const [, token] = authHeader.split(" ");
            if (token) {
                const decoded = (0, jsonwebtoken_1.verify)(token, auth_1.default.secret);
                if (decoded && decoded.id) {
                    const user = await User_1.default.findByPk(decoded.id);
                    if (user && (user.super || user.profile === "admin")) {
                        req.user = {
                            id: String(user.id),
                            profile: user.profile,
                            companyId: user.companyId
                        };
                        return next();
                    }
                }
            }
        }
        catch {
            // Token inválido ou expirado: prossegue para validação via envTokenAuth
        }
    }
    // Requisição não autenticada como SuperAdmin/Admin: exige validação via ENV_TOKEN
    return (0, envTokenAuth_1.default)(req, res, next);
};
exports.default = allowSuperOrEnvToken;
