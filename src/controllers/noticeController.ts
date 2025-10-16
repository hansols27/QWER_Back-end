import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB 기반의 새로운 noticeService 파일을 바라봅니다.
import * as noticeService from "../services/noticeService";

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ✅ 목록 조회
export async function getNotices(req: Request, res: Response) {
    try {
        const notices = await noticeService.getNotices();
        res.json({ success: true, data: notices });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `공지사항 조회 실패: ${getErrorMessage(err)}` });
    }
}

// ✅ 상세 조회
export async function getNotice(req: Request, res: Response) {
    try {
        // noticeService.getNotice는 공지사항이 없으면 Error를 던지도록 수정되었습니다.
        const notice = await noticeService.getNotice(req.params.id);
        res.json({ success: true, data: notice });
    } catch (err) {
        // ⭐️ 404 에러를 서비스 레벨에서 던졌을 때, 여기서 캐치하여 처리합니다.
        const message = getErrorMessage(err);
        if (message.includes("not found") || message.includes("찾을 수 없습니다")) {
            return res.status(404).json({ success: false, message: "공지사항을 찾을 수 없습니다." });
        }
        console.error(err);
        res.status(500).json({ success: false, message: `공지사항 상세 조회 실패: ${message}` });
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
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `공지사항 등록 실패: ${getErrorMessage(err)}` });
    }
}

// ✅ 수정
export async function updateNotice(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { type, title, content } = req.body;
        // noticeService.updateNotice 함수 서명이 유지되어 그대로 호출 가능합니다.
        await noticeService.updateNotice(id, { type, title, content });
        res.json({ success: true, message: "공지사항 수정 완료" });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `공지사항 수정 실패: ${getErrorMessage(err)}` });
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
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `공지사항 삭제 실패: ${getErrorMessage(err)}` });
    }
}