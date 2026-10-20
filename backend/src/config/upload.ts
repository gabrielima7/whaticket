import path from "path";
import multer from "multer";
import fs from "fs";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { ensureFolderPermissions } from "../helpers/EnsurePermissions";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        let companyId = req.user?.companyId;
        const { typeArch, fileId } = req.body;

        if (!companyId) {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return cb(new AppError("Acesso não permitido", 401), "");
          }
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!token) {
            return cb(new AppError("Acesso não permitido", 401), "");
          }
          const whatsapp = await Whatsapp.findOne({ where: { token } });
          if (!whatsapp) {
            return cb(new AppError("Acesso não permitido", 401), "");
          }
          companyId = whatsapp.companyId;
        }

        const safeCompanyId = Number(companyId);
        if (isNaN(safeCompanyId) || safeCompanyId <= 0) {
          return cb(new AppError("Empresa inválida", 400), "");
        }

        let folder: string;

        if (typeArch === "stickers") {
          folder = path.resolve(publicFolder, `company${safeCompanyId}`, "stickers", "salvos");
        } else if (typeArch === "announcements") {
          folder = path.resolve(publicFolder, "announcements");
        } else if (typeArch === "logo") {
          folder = path.resolve(publicFolder);
        } else if (typeArch) {
          const safeTypeArch = String(typeArch).replace(/[^a-zA-Z0-9_-]/g, "");
          const safeFileId = fileId ? String(fileId).replace(/[^a-zA-Z0-9_-]/g, "") : "";
          folder = path.resolve(publicFolder, `company${safeCompanyId}`, safeTypeArch, safeFileId);
        } else {
          folder = path.resolve(publicFolder, `company${safeCompanyId}`);
        }

        const allowedBase = path.resolve(publicFolder);
        if (!folder.startsWith(allowedBase + path.sep) && folder !== allowedBase) {
          return cb(new AppError("Tentativa de Path Traversal detectada", 403), "");
        }

        ensureFolderPermissions(folder);
        return cb(null, folder);
      } catch (err: any) {
        return cb(err, "");
      }
    },
    filename(req, file, cb) {
      const rawExt = path.extname(file.originalname).toLowerCase();
      const dangerousExtensions = [".html", ".htm", ".svg", ".php", ".phtml", ".exe", ".sh", ".bash", ".bat", ".cmd", ".js", ".mjs", ".ts", ".py", ".rb", ".pl"];
      const ext = dangerousExtensions.includes(rawExt) ? ".txt" : rawExt;
      const rawName = path.basename(file.originalname, rawExt);
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const timestamp = Date.now();
      const fileName = `${timestamp}_${sanitizedName}${ext}`;

      return cb(null, fileName);
    }
  })
};
