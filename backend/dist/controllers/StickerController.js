"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.store = exports.index = void 0;
const Sticker_1 = __importDefault(require("../models/Sticker"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sequelize_1 = require("sequelize");
const EnsurePermissions_1 = require("../helpers/EnsurePermissions");
const index = async (req, res) => {
    const { companyId, id: userId } = req.user;
    // Buscar stickers da empresa (userId null) e stickers do usuário atual
    const stickers = await Sticker_1.default.findAll({
        where: {
            companyId,
            [sequelize_1.Op.or]: [
                { userId: null },
                { userId } // Stickers do usuário
            ]
        },
        order: [["createdAt", "DESC"]]
    });
    return res.json(stickers);
};
exports.index = index;
const store = async (req, res) => {
    const { companyId, id: userId } = req.user;
    const file = req.file;
    const { isShared } = req.body;
    if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }
    try {
        const folder = path_1.default.resolve(__dirname, "..", "..", "public", `company${companyId}`, "stickers", "salvos");
        // Criar pasta e garantir permissões corretas
        (0, EnsurePermissions_1.ensureFolderPermissions)(folder);
        if (!file.path || !fs_1.default.existsSync(file.path)) {
            console.error("Arquivo não encontrado no caminho:", file.path);
            return res.status(500).json({ error: "Erro ao salvar arquivo" });
        }
        // Obter extensão do arquivo
        const ext = path_1.default.extname(file.originalname).toLowerCase() || '.webp';
        // Determinar mimetype
        let mimetype = file.mimetype;
        if (!mimetype || (ext === ".gif" && !mimetype.includes("gif")) ||
            (ext === ".webp" && !mimetype.includes("webp")) ||
            (ext === ".png" && !mimetype.includes("png"))) {
            if (ext === ".gif") {
                mimetype = "image/gif";
            }
            else if (ext === ".webp") {
                mimetype = "image/webp";
            }
            else if (ext === ".png") {
                mimetype = "image/png";
            }
            else if (ext === ".jpg" || ext === ".jpeg") {
                mimetype = "image/jpeg";
            }
            else {
                mimetype = "image/webp";
            }
        }
        // NOVO SISTEMA: Gerar ID sequencial (stickers01, stickers02, etc)
        // Buscar o último sticker da empresa para gerar o próximo ID
        const lastSticker = await Sticker_1.default.findOne({
            where: { companyId },
            order: [['id', 'DESC']]
        });
        // Gerar próximo número (com padding de 2 dígitos)
        const nextNumber = lastSticker ? lastSticker.id + 1 : 1;
        const paddedNumber = String(nextNumber).padStart(2, '0');
        const newFileName = `stickers${paddedNumber}${ext}`;
        // Mover arquivo do multer para o nome final
        const oldPath = file.path;
        const newPath = path_1.default.join(folder, newFileName);
        // Se arquivo já existe, encontrar próximo disponível
        let finalFileName = newFileName;
        let finalPath = newPath;
        let counter = nextNumber;
        while (fs_1.default.existsSync(finalPath)) {
            counter++;
            const paddedCounter = String(counter).padStart(2, '0');
            finalFileName = `stickers${paddedCounter}${ext}`;
            finalPath = path_1.default.join(folder, finalFileName);
        }
        // Renomear/mover arquivo
        fs_1.default.renameSync(oldPath, finalPath);
        fs_1.default.chmodSync(finalPath, 0o777);
        const relativePath = `stickers/salvos/${finalFileName}`;
        const sticker = await Sticker_1.default.create({
            companyId,
            userId: isShared === "true" || isShared === true ? null : Number(userId),
            name: file.originalname,
            path: relativePath,
            mimetype
        });
        return res.json(sticker);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.store = store;
const remove = async (req, res) => {
    const { stickerId } = req.params;
    const { companyId, id: userId } = req.user;
    try {
        const sticker = await Sticker_1.default.findOne({
            where: {
                id: stickerId,
                companyId,
                [sequelize_1.Op.or]: [
                    { userId: null },
                    { userId } // Stickers do usuário só podem ser removidos pelo dono
                ]
            }
        });
        if (!sticker) {
            return res.status(404).json({ error: "Sticker não encontrado" });
        }
        // Remover arquivo
        const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
        // Path no banco sempre é: stickers/salvos/nome.ext
        // Arquivo físico está em: companyId/stickers/salvos/nome.ext
        // Construir caminho correto: companyId/stickers/salvos/nome.ext
        let filePath = path_1.default.join(publicFolder, `company${companyId}`, sticker.path);
        // Se não encontrar no local correto, tentar estruturas alternativas (compatibilidade)
        if (!fs_1.default.existsSync(filePath)) {
            // Tentar estrutura antiga (raiz da company)
            const altPath1 = path_1.default.join(publicFolder, `company${companyId}`, path_1.default.basename(sticker.path));
            if (fs_1.default.existsSync(altPath1)) {
                filePath = altPath1;
                console.log(`Sticker encontrado em localização antiga: ${altPath1}`);
            }
            else {
                // Tentar estrutura muito antiga
                const altPath2 = path_1.default.join(publicFolder, "stickers", `company${companyId}`, sticker.path);
                if (fs_1.default.existsSync(altPath2)) {
                    filePath = altPath2;
                    console.log(`Sticker encontrado em localização muito antiga: ${altPath2}`);
                }
                else {
                    // Tentar em stickers/ (recebidos/enviados)
                    const altPath3 = path_1.default.join(publicFolder, `company${companyId}`, "stickers", path_1.default.basename(sticker.path));
                    if (fs_1.default.existsSync(altPath3)) {
                        filePath = altPath3;
                        console.log(`Sticker encontrado em stickers/: ${altPath3}`);
                    }
                }
            }
        }
        if (fs_1.default.existsSync(filePath)) {
            try {
                fs_1.default.unlinkSync(filePath);
                console.log(`Sticker removido: ${filePath}`);
            }
            catch (err) {
                console.error(`Erro ao remover arquivo: ${filePath}`, err);
                // Continuar mesmo se falhar a remoção do arquivo
            }
        }
        else {
            // Não é erro crítico se o arquivo não existir (pode ter sido removido manualmente)
            console.warn(`Arquivo não encontrado para remoção: ${filePath} (path: ${sticker.path})`);
        }
        await sticker.destroy();
        return res.json({ message: "Sticker removido com sucesso" });
    }
    catch (err) {
        console.error("Erro ao remover sticker:", err);
        return res.status(500).json({ error: err.message });
    }
};
exports.remove = remove;
