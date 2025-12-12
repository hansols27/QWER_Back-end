import { Router } from "express";
import multer from "multer";
// ⭐️ 컨트롤러 임포트: 모든 비즈니스 로직(DB, S3 호출)을 위임받은 함수들
import * as galleryController from "@controllers/galleryController"; 

const router = Router();
// 🚨 TABLE_NAME 제거 (서비스 계층으로 이동)

// Multer 설정: 파일 수신은 라우터 계층의 역할이므로 유지합니다.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("지원되는 이미지 형식은 jpg, jpeg, png만 가능합니다."));
        }
        cb(null, true);
    },
});

// ----------------------------------------------------
// 1. 갤러리 목록 조회
// ----------------------------------------------------
// GET /api/gallery
router.get("/", galleryController.getGallery);

// ----------------------------------------------------
// 2. 갤러리 상세 조회 (라우터에는 없었으나, 컨트롤러에 맞게 추가할 수 있습니다)
// ----------------------------------------------------

// ----------------------------------------------------
// 3. 다중 이미지 등록
// ----------------------------------------------------
// POST /api/gallery
// ⭐️ Multer 미들웨어로 파일을 받고 컨트롤러로 전달합니다.
router.post("/upload", upload.array("images"), galleryController.uploadGallery);

// 다중 삭제 (DELETE /api/gallery)
router.delete("/", galleryController.deleteMultipleGallery);

// 단일 삭제 (DELETE /api/gallery/:id)
router.delete("/:id", galleryController.deleteGallery);



export default router;