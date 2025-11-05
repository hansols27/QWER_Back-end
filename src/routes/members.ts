import { Router } from "express";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import * as profileController from "@controllers/profileController"; 

const router = Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 제한 (파일 크기 제한은 라우터 미들웨어의 역할이므로 유지)

// ----------------------------------------------------
// 1. Multer 설정 및 에러 핸들러 (라우터 계층의 역할이므로 유지)
// ----------------------------------------------------

// Multer 설정
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }, 
    fileFilter: (req, file, cb) => { 
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); 
        } else {
            cb(new Error("허용되지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다."));
        }
    }
});

// Multer 에러 핸들러 미들웨어
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

// GET /api/profiles/:id (프로필 상세 조회)
// ⭐️ 로직을 컨트롤러로 위임
router.get("/:id", profileController.getProfile); 

router.post(
    "/:id", // ⭐️ URL을 /:id로 수정하여 컨트롤러와 일치시킵니다.
    upload.array("images"), // Multer 미들웨어 적용
    errorHandler,           // Multer 에러 핸들러 적용
    profileController.createOrUpdateProfile // ⭐️ 로직을 컨트롤러로 위임
); 

export default router;