import * as fs from "fs";
import * as path from "path";
import AppError from "../../errors/AppError";

// O diretório de backups fica dentro do backend
const BACKEND_ROOT = process.cwd();
const BACKUP_DIR = path.resolve(BACKEND_ROOT, "backups");

const DeleteBackupService = async (backupId: string): Promise<void> => {
  if (!backupId || !/^[a-zA-Z0-9_-]+$/.test(backupId)) {
    throw new AppError("Identificador de backup inválido", 400);
  }

  const backupPath = path.resolve(BACKUP_DIR, `${backupId}.zip`);

  if (!backupPath.startsWith(BACKUP_DIR + path.sep)) {
    throw new AppError("Acesso não permitido", 403);
  }

  if (!fs.existsSync(backupPath)) {
    throw new AppError("Backup não encontrado", 404);
  }

  try {
    await fs.promises.unlink(backupPath);
  } catch (error: any) {
    throw new AppError(`Erro ao excluir backup: ${error.message}`, 500);
  }
};

export default DeleteBackupService;

