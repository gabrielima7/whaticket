"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = require("bcryptjs");
const sequelize_1 = require("sequelize");
const User_1 = __importDefault(require("../../models/User"));
const ResetPassword = async (email, token, password) => {
    const user = await User_1.default.findOne({
        where: {
            email,
            resetPassword: {
                [sequelize_1.Op.ne]: ""
            }
        }
    });
    if (!user) {
        return { status: 404, message: "Email não encontrado" };
    }
    if (user.resetPassword !== token) {
        return { status: 404, message: "Token não encontrado" };
    }
    const hashedPassword = await (0, bcryptjs_1.hash)(password, 8);
    await user.update({
        passwordHash: hashedPassword,
        resetPassword: ""
    });
    return { status: 200, message: "Senha atualizada com sucesso" };
};
exports.default = ResetPassword;
