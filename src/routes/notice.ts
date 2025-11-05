import { Router } from "express";
// ⭐️ 컨트롤러 임포트: 모든 로직 처리를 위임할 컨트롤러
import * as noticeController from "@controllers/noticeController"; 

const router = Router();

// ----------------------------------------------------
// 1. GET /api/notice (공지사항 목록 조회)
// ----------------------------------------------------
// ⭐️ 로직을 컨트롤러 함수로 대체
router.get("/", noticeController.getNotices);

// ----------------------------------------------------
// 2. GET /api/notice/:id (공지사항 상세 조회)
// ----------------------------------------------------
// ⭐️ 로직을 컨트롤러 함수로 대체
router.get("/:id", noticeController.getNotice);

// ----------------------------------------------------
// 3. POST /api/notice (공지사항 등록)
// ----------------------------------------------------
// ⭐️ 로직을 컨트롤러 함수로 대체
router.post("/", noticeController.createNotice);

// ----------------------------------------------------
// 4. PUT /api/notice/:id (공지사항 수정)
// ----------------------------------------------------
// ⭐️ 로직을 컨트롤러 함수로 대체
router.put("/:id", noticeController.updateNotice);

// ----------------------------------------------------
// 5. DELETE /api/notice/:id (공지사항 삭제)
// ----------------------------------------------------
// ⭐️ 로직을 컨트롤러 함수로 대체
router.delete("/:id", noticeController.deleteNotice);

export default router;