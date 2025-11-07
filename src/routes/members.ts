import { Router } from "express";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import * as profileController from "@controllers/profileController"; 

const router = Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 제한 

// ----------------------------------------------------
// 1. Multer 설정 및 에러 핸들러
// ----------------------------------------------------

// Multer 설정
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }, 
    fileFilter: (req, file, cb) => { 
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); 
        } else {
            // 파일을 배열로 받고 'images' 필드 이름을 사용합니다. (컨트롤러와 일치)
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

// GET /api/profiles/:id (프로필 상세 조회)
router.get("/:id", profileController.getProfile); 

// POST/PUT 라우트 정의 (Upsert 처리를 위한 미들웨어 통합)
const upsertProfileRoutes = [
    // 1. 이미지 파일 처리 미들웨어: Multer는 'images' 필드의 파일들을 req.files에 저장
    upload.array("images"), 
    // 2. Multer 에러 처리
    errorHandler,           
    // 3. 최종 컨트롤러 로직 (payload 파싱, S3/DB 저장)
    profileController.createOrUpdateProfile 
];

// POST /api/profiles/:id (생성/Upsert)
router.post(
    "/:id", 
    ...upsertProfileRoutes
); 

// ⭐️ PUT /api/profiles/:id (업데이트/Upsert)
router.put(
    "/:id", 
    ...upsertProfileRoutes
); 

export default router;