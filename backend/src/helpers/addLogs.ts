import * as fsp from "fs/promises";
import path from "path";
import * as fs from "fs";

export async function addLogs({ fileName, text, forceNewFile = false }) {
  const logs = path.resolve(__dirname, "..", "..", "logs");
  const safeFileName = path
    .basename(String(fileName || "system.log"))
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.resolve(logs, safeFileName);

  if (!filePath.startsWith(logs + path.sep)) {
    return;
  }

  try {
    if (!fs.existsSync(logs)) {
      fs.mkdirSync(logs, { recursive: true });
    }
  } catch (error) {
    // ignore mkdir race
  }

  try {
    if (forceNewFile) {
      await fsp.writeFile(filePath, `${text} \n`);
    } else {
      await fsp.appendFile(filePath, `${text} \n`);
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await fsp.writeFile(filePath, `${text} \n`);
    } else {
      console.error("Erro ao manipular o arquivo de log:", err);
    }
  }
}
