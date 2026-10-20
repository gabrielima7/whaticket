import path from "path";
import multer from "multer";
import AppError from "../errors/AppError";

const publicFolder = path.resolve(__dirname, "..", "..", "public", "logotipos");

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      try {
        const rawRef = req.query.ref ? String(req.query.ref) : "logo";
        const sanitizedRef = rawRef.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);

        if (!sanitizedRef) {
          return cb(new AppError("Nome de referência do logotipo inválido", 400), "");
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg"];
        const safeExt = allowedExtensions.includes(ext) ? ext : ".png";

        const desiredFileName = `${sanitizedRef}${safeExt}`;
        const targetPath = path.resolve(publicFolder, desiredFileName);

        if (!targetPath.startsWith(publicFolder + path.sep)) {
          return cb(new AppError("Tentativa de Path Traversal detectada", 403), "");
        }

        return cb(null, desiredFileName);
      } catch (err: any) {
        return cb(err, "");
      }
    }
  })
};
