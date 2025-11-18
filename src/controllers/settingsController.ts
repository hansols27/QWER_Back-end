import { Request, Response } from "express";
import * as settingsService from "@services/settingsService"; 
import type { SnsLink } from "@/types/settings"; // @/types/settings 경로 조정 필요
import type { Express } from "express"; 

// ----------------------------------------------------
// 1. 헬퍼 함수
// ----------------------------------------------------

// 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred";
};

// 💡 개선점: URL 형식 유효성 검사 헬퍼 추가
const isValidUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// ----------------------------------------------------
// 2. 컨트롤러 함수
// ----------------------------------------------------

/**
 * 설정 조회
 */
export const getSettings = async (req: Request, res: Response) => {
    try {
        const settings = await settingsService.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("GET /settings 오류:", err);
        // 서버 내부 오류 (DB, S3 연결 등)는 500으로 응답
        res.status(500).json({ success: false, message: `Failed to fetch settings: ${getErrorMessage(err)}` });
    }
};

/**
 * 설정 저장
 */
export const saveSettings = async (req: Request, res: Response) => {
    try {
        let snsLinks: SnsLink[] = [];

        // SNS 링크 검증 및 파싱 (라우터의 Multer에서 넘어온 JSON 문자열 처리)
        if (req.body.snsLinks) {
            try {
                snsLinks = JSON.parse(req.body.snsLinks); 
                
                // 💡 개선점: id/url 타입, 비어있는지, 유효한 URL인지 모두 검사
                if (
                    !Array.isArray(snsLinks) || // 배열이 아니거나
                    !snsLinks.every(link => 
                        typeof link.id === "string" && link.id.length > 0 && // id는 비어있지 않은 문자열
                        typeof link.url === "string" && link.url.length > 0 && // url도 비어있지 않은 문자열
                        isValidUrl(link.url) // 유효한 URL 형식
                    )
                ) {
                    return res.status(400).json({ success: false, message: "Invalid SNS links format, ID or URL missing/invalid." });
                }
            } catch {
                // JSON.parse에서 오류 발생 시
                return res.status(400).json({ success: false, message: "SNS links must be a valid JSON array" });
            }
        }

        const file = req.file as Express.Multer.File | undefined;
        
        const settings = await settingsService.saveSettings(snsLinks, file);

        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("POST /settings 오류:", err);
        // 서비스 계층에서 던진 오류 (DB 트랜잭션 실패, S3 업로드 실패 등)는 500으로 응답
        res.status(500).json({ success: false, message: `Failed to save settings: ${getErrorMessage(err)}` });
    }
};

/**
 * 메인 이미지 삭제
 */
export const deleteMainImage = async (req: Request, res: Response) => {
    try {
        const deleted = await settingsService.deleteMainImage();

        if (!deleted) {
             // 삭제할 대상이 없었음 (200 OK)
            return res.status(200).json({ success: true, message: "삭제할 메인 이미지가 없습니다." });
        }

        res.status(200).json({ success: true, message: '메인 이미지 삭제 및 설정 업데이트 완료' });
    } catch (err) {
        console.error("DELETE /image 오류:", err);
        res.status(500).json({ success: false, message: `Failed to delete main image: ${getErrorMessage(err)}` });
    }
};