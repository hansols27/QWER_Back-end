import { Router } from "express";
import multer from "multer";
import * as galleryController from "../controllers/galleryController";

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

// 갤러리 목록 조회
router.get("/", galleryController.getGallery);

// 이미지 업로드 (다중 이미지 가능)
router.post("/", upload.array("images"), galleryController.uploadGallery);

// 이미지 삭제
router.delete("/:id", galleryController.deleteGallery);

export default router;
