"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Corrige as permissões de todas as pastas de company no diretório public
 * Garante que pastas tenham 0o755 e arquivos 0o644
 */
const fixCompanyFoldersPermissions = () => {
    const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
    console.log("🔧 Iniciando correção de permissões...");
    console.log(`📁 Pasta public: ${publicFolder}`);
    try {
        // Garantir que a pasta public tenha permissão 755
        if (fs_1.default.existsSync(publicFolder)) {
            fs_1.default.chmodSync(publicFolder, 0o755);
            console.log("✅ Permissões da pasta public ajustadas");
        }
        // Ler todos os itens do diretório public
        const items = fs_1.default.readdirSync(publicFolder);
        let companiesFixed = 0;
        items.forEach(item => {
            const itemPath = path_1.default.join(publicFolder, item);
            const stats = fs_1.default.statSync(itemPath);
            // Processar apenas pastas que começam com "company"
            if (stats.isDirectory() && item.startsWith("company")) {
                console.log(`\n📂 Processando: ${item}`);
                // Corrigir permissões da pasta principal
                fs_1.default.chmodSync(itemPath, 0o755);
                console.log(`  ✅ Permissões ajustadas: ${item}/`);
                // Corrigir permissões de subpastas recursivamente
                fixPermissionsRecursively(itemPath, "  ");
                companiesFixed++;
            }
        });
        console.log(`\n🎉 Concluído! ${companiesFixed} pasta(s) de company processada(s)`);
        console.log("✨ Todas as permissões foram ajustadas (pastas: 755, arquivos: 644)");
    }
    catch (error) {
        console.error("❌ Erro ao corrigir permissões:", error);
        throw error;
    }
};
/**
 * Função recursiva para corrigir permissões de subpastas e arquivos
 */
const fixPermissionsRecursively = (dirPath, indent = "") => {
    try {
        const items = fs_1.default.readdirSync(dirPath);
        items.forEach(item => {
            const itemPath = path_1.default.join(dirPath, item);
            try {
                const stats = fs_1.default.statSync(itemPath);
                if (stats.isDirectory()) {
                    // Corrigir permissões da pasta (755)
                    fs_1.default.chmodSync(itemPath, 0o755);
                    console.log(`${indent}  ✅ ${item}/`);
                    // Processar recursivamente
                    fixPermissionsRecursively(itemPath, indent + "  ");
                }
                else {
                    // Corrigir permissões do arquivo (644)
                    fs_1.default.chmodSync(itemPath, 0o644);
                }
            }
            catch (err) {
                console.log(`${indent}  ⚠️  Não foi possível ajustar: ${item}`);
            }
        });
    }
    catch (error) {
        console.error(`${indent}  ❌ Erro ao ler diretório: ${dirPath}`, error);
    }
};
// Executar a função
fixCompanyFoldersPermissions();
exports.default = fixCompanyFoldersPermissions;
