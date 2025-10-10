import { Router } from "express";
import multer from "multer";
import * as settingsController from "../controllers/settingsController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * /api/settings
 */

// ✅ GET: 설정 조회
router.get("/", settingsController.getSettings);

// ✅ POST: 설정 저장 (메인 이미지 + SNS 링크)
router.post("/", upload.single("image"), settingsController.saveSettings);

export default router;
