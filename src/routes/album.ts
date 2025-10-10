import { Router } from "express";
import multer from "multer";
import * as albumController from "../controllers/albumController";

const router = Router();

// Multer 설정 (메모리 저장, 이미지 파일만 허용, 최대 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

// 앨범 목록 조회
router.get("/", albumController.getAlbums);

// 단일 앨범 조회
router.get("/:id", albumController.getAlbum);

// 앨범 등록 (커버 이미지 업로드 가능)
router.post("/", upload.single("image"), albumController.createAlbum);

// 앨범 수정 (커버 이미지 업로드 가능)
router.put("/:id", upload.single("image"), albumController.updateAlbum);

// 앨범 삭제
router.delete("/:id", albumController.deleteAlbum);

export default router;
