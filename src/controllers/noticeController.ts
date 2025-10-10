import { Request, Response } from "express";
import * as noticeService from "../services/noticeService";

// ✅ 목록 조회
export async function getNotices(req: Request, res: Response) {
  try {
    const notices = await noticeService.getNotices();
    res.json({ success: true, data: notices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "공지사항 조회 실패" });
  }
}

// ✅ 상세 조회
export async function getNotice(req: Request, res: Response) {
  try {
    const notice = await noticeService.getNotice(req.params.id);
    res.json({ success: true, data: notice });
  } catch (err) {
    console.error(err);
    res.status(404).json({ success: false, message: "공지사항을 찾을 수 없습니다." });
  }
}

// ✅ 등록
export async function createNotice(req: Request, res: Response) {
  try {
    const { type, title, content } = req.body;
    if (!type || !title || !content) {
      return res.status(400).json({ success: false, message: "필수 필드가 누락되었습니다." });
    }

    const newNotice = await noticeService.createNotice({ type, title, content });
    res.status(201).json({ success: true, data: newNotice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "공지사항 등록 실패" });
  }
}

// ✅ 수정
export async function updateNotice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { type, title, content } = req.body;
    await noticeService.updateNotice(id, { type, title, content });
    res.json({ success: true, message: "공지사항 수정 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "공지사항 수정 실패" });
  }
}

// ✅ 삭제
export async function deleteNotice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await noticeService.deleteNotice(id);
    res.json({ success: true, message: "공지사항 삭제 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "공지사항 삭제 실패" });
  }
}
