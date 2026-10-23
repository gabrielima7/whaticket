import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";

import * as SettingController from "../controllers/SettingController";
import { testBirthdayReminder } from "../controllers/BirthdayReminderController";
import multer from "multer";
import uploadConfig from "../config/uploadlogo";
import uploadGerencianetCertConfig from "../config/uploadGerencianetCert";

const upload = multer(uploadConfig);
const uploadGerencianetCert = multer(uploadGerencianetCertConfig);

const settingRoutes = Router();

settingRoutes.get("/settings", isAuth, SettingController.index);

settingRoutes.get(
  "/settings/test-birthday-reminder",
  isAuth,
  testBirthdayReminder
);

settingRoutes.get("/settings/:settingKey", SettingController.show);

settingRoutes.put("/settings/:settingKey", isAuth, SettingController.update);

settingRoutes.post(
  "/settings/media-upload",
  isAuth,
  isSuper,
  upload.array("file"),
  SettingController.mediaUpload
);

settingRoutes.post(
  "/settings/gerencianet-cert-upload",
  isAuth,
  isSuper,
  uploadGerencianetCert.single("file"),
  SettingController.gerencianetCertUpload
);

export default settingRoutes;
