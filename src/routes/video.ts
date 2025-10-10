import { Router } from "express";
import * as videoController from "../controllers/videoController";

const router = Router();

/**
 * /api/videos
 */

// ✅ GET: 전체 영상 조회
router.get("/", videoController.getVideos);

// ✅ GET: 단일 영상 조회
router.get("/:id", videoController.getVideoById);

// ✅ POST: 영상 등록
router.post("/", videoController.createVideo);

// ✅ PUT: 영상 수정
router.put("/:id", videoController.updateVideo);

// ✅ DELETE: 영상 삭제
router.delete("/:id", videoController.deleteVideo);

export default router;
