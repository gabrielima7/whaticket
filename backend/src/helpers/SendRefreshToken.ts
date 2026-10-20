import { Response } from "express";

const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

export const SendRefreshToken = (res: Response, token: string): void => {
  const isHttps =
    process.env.BACKEND_URL?.startsWith("https://") ||
    Boolean(process.env.COOKIE_SECURE === "true");

  res.cookie("jrt", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: sevenDaysInMs
  });
};
