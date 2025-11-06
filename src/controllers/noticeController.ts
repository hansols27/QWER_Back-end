import { Request, Response } from "express";
import * as noticeService from "@services/noticeService"; 

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// ✅ 목록 조회
// ----------------------------------------------------
export async function getNotices(req: Request, res: Response) {
    try {
        const notices = await noticeService.getNotices();
        res.json({ success: true, data: notices });
    } catch (err) {
        console.error("GET /notice 오류:", err);
        res.status(500).json({ success: false, message: `공지사항 조회 실패: ${getErrorMessage(err)}` });
    }
}

// ----------------------------------------------------
// ✅ 상세 조회
// ----------------------------------------------------
export async function getNotice(req: Request, res: Response) {
    try {
        // ⭐️ 서비스의 반환 값 변경 (null 반환)을 반영
        const notice = await noticeService.getNotice(req.params.id);
        
        if (!notice) {
            // 404 Not Found 처리
            return res.status(404).json({ success: false, message: "공지사항을 찾을 수 없습니다." });
        }
        
        res.json({ success: true, data: notice });
    } catch (err) {
        console.error("GET /notice/:id 오류:", err);
        // 기타 DB 또는 알 수 없는 오류는 500 처리
        res.status(500).json({ success: false, message: `공지사항 상세 조회 실패: ${getErrorMessage(err)}` });
    }
}

// ----------------------------------------------------
// ✅ 등록
// ----------------------------------------------------
export async function createNotice(req: Request, res: Response) {
    try {
        const { type, title, content } = req.body;
        if (!type || !title || !content) {
            return res.status(400).json({ success: false, message: "필수 필드가 누락되었습니다." });
        }

        const newNotice = await noticeService.createNotice({ type, title, content });
        res.status(201).json({ success: true, data: newNotice });
    } catch (err) {
        console.error("POST /notice 오류:", err);
        res.status(500).json({ success: false, message: `공지사항 등록 실패: ${getErrorMessage(err)}` });
    }
}

// ----------------------------------------------------
// ✅ 수정
// ----------------------------------------------------
export async function updateNotice(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // ⭐️ 기존의 getNotice 호출 제거 및 affectedRows 확인 로직 추가
        const affectedRows = await noticeService.updateNotice(id, updateData);
        
        if (affectedRows === 0) {
            // 수정된 행이 없으면 404 처리
            return res.status(404).json({ success: false, message: "수정할 공지사항을 찾을 수 없습니다." });
        }
        
        res.json({ success: true, message: "공지사항 수정 완료" });
    } catch (err) {
        console.error("PUT /notice/:id 오류:", err);
        res.status(500).json({ success: false, message: `공지사항 수정 실패: ${getErrorMessage(err)}` });
    }
}

// ----------------------------------------------------
// ✅ 삭제
// ----------------------------------------------------
export async function deleteNotice(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // ⭐️ 기존의 getNotice 호출 제거 및 affectedRows 확인 로직 추가
        const affectedRows = await noticeService.deleteNotice(id);
        
        if (affectedRows === 0) {
            // 삭제된 행이 없으면 404 처리
            return res.status(404).json({ success: false, message: "삭제할 공지사항을 찾을 수 없습니다." });
        }
        
        res.json({ success: true, message: "공지사항 삭제 완료" });
    } catch (err) {
        console.error("DELETE /notice/:id 오류:", err);
        res.status(500).json({ success: false, message: `공지사항 삭제 실패: ${getErrorMessage(err)}` });
    }
}