"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSuggestions = void 0;
const AppError_1 = __importDefault(require("../errors/AppError"));
const GenerateSuggestionsService_1 = __importDefault(require("../services/GeminiServices/GenerateSuggestionsService"));
const generateSuggestions = async (req, res) => {
    const { prompt } = req.body;
    const { companyId } = req.user;
    if (!prompt) {
        throw new AppError_1.default("Prompt é obrigatório", 400);
    }
    try {
        const suggestions = await (0, GenerateSuggestionsService_1.default)({
            prompt,
            companyId
        });
        return res.status(200).json({ suggestions });
    }
    catch (error) {
        console.error("Erro no controller Gemini:", error);
        if (error instanceof AppError_1.default) {
            return res.status(error.statusCode).json({
                error: error.message,
                statusCode: error.statusCode
            });
        }
        const errorMessage = error?.message || error?.toString() || "Erro desconhecido ao gerar sugestões";
        return res.status(500).json({
            error: errorMessage,
            statusCode: 500
        });
    }
};
exports.generateSuggestions = generateSuggestions;
