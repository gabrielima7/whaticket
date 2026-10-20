"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendRefreshToken = void 0;
const isProduction = process.env.NODE_ENV === "production";
const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
const SendRefreshToken = (res, token) => {
    res.cookie("jrt", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        path: "/",
        maxAge: sevenDaysInMs
    });
};
exports.SendRefreshToken = SendRefreshToken;
