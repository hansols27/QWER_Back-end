import { Router } from "express";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import * as settingsController from "../controllers/settingsController";

const router = Router();
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB 제한

// ----------------------------------------------------
// 1. Multer 설정
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

// ----------------------------------------------------
// 2. Multer 에러 핸들러
// ----------------------------------------------------
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
// 3. 라우터 엔드포인트 정의 (수정된 부분)
// ----------------------------------------------------

router.get("/", settingsController.getSettings); 

// POST /api/settings (설정 업데이트 및 이미지 교체/업로드)
router.post(
    "/", 
    // ⭐️ Multer 조건부 실행 미들웨어
    (req: Request, res: Response, next: NextFunction) => {
        const contentType = req.headers['content-type'];
        
        // 요청이 'multipart/form-data'로 시작하는 경우에만 Multer 실행
        if (contentType && contentType.startsWith('multipart/form-data')) {
            upload.single('image')(req, res, (err) => {
                if (err) {
                    // Multer 에러 처리 후 응답
                    return errorHandler(err, req, res, next);
                }
                // 성공적으로 파일 처리 후 다음 단계(컨트롤러)로 이동
                next(); 
            });
        } else {
            // JSON 요청은 Multer를 건너뛰고 바로 컨트롤러로 이동
            next();
        }
    },
    settingsController.saveSettings
); 

router.delete("/image", settingsController.deleteMainImage);

export default router;