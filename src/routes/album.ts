import { Router } from "express";
import multer from "multer";
import * as albumController from "@controllers/albumController"; 

const router = Router();

// Multer 설정: 라우터의 고유 역할이므로 유지합니다.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("지원되는 이미지 형식은 jpg, jpeg, png만 가능합니다."));
        }
        cb(null, true);
    },
});

// ---
// 1. 앨범 목록 조회 (GET /api/album)
// ---
// ⭐️ 라우터 핸들러를 컨트롤러 함수로 대체
router.get("/", albumController.getAlbums); 

// ---
// 2. 앨범 상세 조회 (GET /api/album/:id)
// ---
// ⭐️ 라우터 핸들러를 컨트롤러 함수로 대체
router.get("/:id", albumController.getAlbum);

// ---
// 3. 앨범 등록 (POST /api/album)
// ---
// ⭐️ Multer 미들웨어 적용 후 컨트롤러 함수로 전달
router.post("/", upload.single("coverFile"), albumController.createAlbum);

// ---
// 4. 앨범 수정 (PUT /api/album/:id)
// ---
// ⭐️ Multer 미들웨어 적용 후 컨트롤러 함수로 전달
router.put("/:id", upload.single("coverFile"), albumController.updateAlbum);

// ---
// 5. 앨범 삭제 (DELETE /api/album/:id)
// ---
// ⭐️ 라우터 핸들러를 컨트롤러 함수로 대체
router.delete("/:id", albumController.deleteAlbum);

export default router;