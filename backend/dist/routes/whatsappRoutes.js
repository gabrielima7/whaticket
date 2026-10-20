"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuth_1 = __importDefault(require("../middleware/isAuth"));
const multer_1 = __importDefault(require("multer"));
const upload_1 = __importDefault(require("../config/upload"));
const upload = (0, multer_1.default)(upload_1.default);
const WhatsAppController = __importStar(require("../controllers/WhatsAppController"));
const HolidayPeriodController = __importStar(require("../controllers/HolidayPeriodController"));
const whatsappRoutes = express_1.default.Router();
whatsappRoutes.get("/whatsapp/", isAuth_1.default, WhatsAppController.index);
whatsappRoutes.post("/whatsapp/", isAuth_1.default, WhatsAppController.store);
whatsappRoutes.get("/whatsapp/:whatsappId", isAuth_1.default, WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId", isAuth_1.default, WhatsAppController.update);
whatsappRoutes.post("/whatsapp-restart/", isAuth_1.default, WhatsAppController.restart);
whatsappRoutes.delete("/whatsapp/:whatsappId", isAuth_1.default, WhatsAppController.remove);
whatsappRoutes.post("/whatsapp/:whatsappId/greeting-media", isAuth_1.default, upload.single("file"), WhatsAppController.greetingMediaUpload);
whatsappRoutes.delete("/whatsapp/:whatsappId/greeting-media", isAuth_1.default, WhatsAppController.deleteGreetingMedia);
// Holiday Periods routes
whatsappRoutes.get("/whatsapp/:whatsappId/holiday-periods", isAuth_1.default, HolidayPeriodController.index);
whatsappRoutes.post("/whatsapp/:whatsappId/holiday-periods", isAuth_1.default, HolidayPeriodController.store);
whatsappRoutes.put("/whatsapp/:whatsappId/holiday-periods/:id", isAuth_1.default, HolidayPeriodController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId/holiday-periods/:id", isAuth_1.default, HolidayPeriodController.remove);
exports.default = whatsappRoutes;
