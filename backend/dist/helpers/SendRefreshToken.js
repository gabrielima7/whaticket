"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendRefreshToken = void 0;
const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
const SendRefreshToken = (res, token) => {
    const isHttps = process.env.BACKEND_URL?.startsWith("https://") ||
        Boolean(process.env.COOKIE_SECURE === "true");
    res.cookie("jrt", token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
        maxAge: sevenDaysInMs
    });
};
exports.SendRefreshToken = SendRefreshToken;
