import { Router } from "express";
import * as noticeController from "../controllers/noticeController";

const router = Router();

// ✅ 공지사항 목록 조회
router.get("/", noticeController.getNotices);

// ✅ 공지사항 상세 조회
router.get("/:id", noticeController.getNotice);

// ✅ 공지사항 등록
router.post("/", noticeController.createNotice);

// ✅ 공지사항 수정
router.put("/:id", noticeController.updateNotice);

// ✅ 공지사항 삭제
router.delete("/:id", noticeController.deleteNotice);

export default router;
