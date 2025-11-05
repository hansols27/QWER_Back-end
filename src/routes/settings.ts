import { Router } from "express";
import multer from "multer";
import { NextFunction, Request, Response } from "express";

// ⭐️ 컨트롤러 임포트: 모든 비즈니스 로직을 위임합니다.
import * as settingsController from "../controllers/settingsController";

const router = Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 제한

// ----------------------------------------------------
// 1. Multer 설정 및 에러 핸들러 (라우터 계층의 역할)
// ----------------------------------------------------

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }, 
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error("허용되지 않는 파일 형식입니다. 이미지 파일(PNG, JPEG, GIF)만 업로드 가능합니다.")); 
        }
    }
});

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            success: false, 
            message: `업로드 오류: ${err.code === 'LIMIT_FILE_SIZE' ? `최대 ${MAX_FILE_SIZE / 1024 / 1024}MB 파일 크기를 초과했습니다.` : err.message}` 
        });
    }
    if (err instanceof Error && err.message.includes("허용되지 않는 파일 형식입니다.")) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err); 
};


// ----------------------------------------------------
// 2. 라우터 엔드포인트 정의 및 컨트롤러 위임
// ----------------------------------------------------

// GET /api/settings (설정 조회)
router.get("/", settingsController.getSettings); 

// POST /api/settings (설정 업데이트 및 이미지 교체/업로드)
router.post(
    "/", 
    upload.single("image"), // 🚨 Multer 필드 이름 'image'를 사용하도록 수정
    errorHandler,
    settingsController.saveSettings
); 

// DELETE /api/settings/image (메인 이미지 완전 삭제)
// ⭐️ 로직을 마이그레이션한 컨트롤러 함수 호출
router.delete("/image", settingsController.deleteMainImage);

export default router;