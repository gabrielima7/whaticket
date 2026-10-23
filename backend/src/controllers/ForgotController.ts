import { v4 as uuid } from "uuid";
import { Request, Response } from "express";
import SendMail from "../services/ForgotPassWordServices/SendMail";
import ResetPassword from "../services/ResetPasswordService/ResetPassword";

type IndexQuery = { email?: string; token?: string; password?: string };

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.params as IndexQuery;
  const { language } = req.query as { language?: string };
  const TokenSenha = uuid();
  const forgotPassword = await SendMail(email, TokenSenha, language);

  if (!forgotPassword || forgotPassword.status === 200) {
    return res.status(200).json({ message: "E-mail enviado com sucesso" });
  }

  return res.status(forgotPassword.status || 404).json({
    error: forgotPassword.message || "E-mail não encontrado"
  });
};

export const resetPasswords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, token, password } = req.params as IndexQuery;
  const resetPassword = await ResetPassword(email, token, password);

  if (!resetPassword || resetPassword.status === 200) {
    return res.status(200).json({ message: "Senha redefinida com sucesso" });
  }

  return res.status(resetPassword.status || 404).json({
    error: resetPassword.message || "Verifique o Token informado"
  });
};
