import path from "path";
import multer from "multer";
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

        const companyFolder = path.resolve(
          publicFolder,
          `company${safeCompanyId}`
        );
        const folder = path.resolve(companyFolder, "quick");

        if (!folder.startsWith(publicFolder + path.sep)) {
          return cb(
            new AppError("Tentativa de Path Traversal detectada", 403),
            ""
          );
        }

        ensureFolderPermissions(companyFolder);
        ensureFolderPermissions(folder);

        return cb(null, folder);
      } catch (err: any) {
        return cb(err, "");
      }
    },
    filename(req, file, cb) {
      const rawExt = path.extname(file.originalname).toLowerCase();
      const dangerousExtensions = [
        ".html",
        ".htm",
        ".svg",
        ".php",
        ".phtml",
        ".exe",
        ".sh",
        ".bash",
        ".bat",
        ".cmd",
        ".js",
        ".mjs",
        ".ts",
        ".py",
        ".rb",
        ".pl"
      ];
      const ext = dangerousExtensions.includes(rawExt) ? ".txt" : rawExt;
      const rawName = path.basename(file.originalname, rawExt);
      const sanitizedName = rawName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 100);
      const fileName = `${Date.now()}_${sanitizedName}${ext}`;
      return cb(null, fileName);
    }
  })
};
