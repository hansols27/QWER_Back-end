import { Request, Response } from "express";
import * as settingsService from "@services/settingsService"; 
import type { SnsLink } from "@/types/settings"; 
import type { Express } from "express"; 

// ----------------------------------------------------
// 1. 헬퍼 함수
// ----------------------------------------------------

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred";
};

// URL 형식 유효성 검사 헬퍼
const isValidUrl = (url: string): boolean => {
    // http:// 또는 https://로 시작해야 유효하다고 간주
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
    }
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

export const getSettings = async (req: Request, res: Response) => {
    try {
        const settings = await settingsService.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("GET /settings 오류:", err);
        res.status(500).json({ success: false, message: `Failed to fetch settings: ${getErrorMessage(err)}` });
    }
};

/**
 * 설정 저장 (JSON 요청과 Multipart 요청을 구분하여 처리)
 */
export const saveSettings = async (req: Request, res: Response) => {
    try {
        let snsLinks: SnsLink[] = [];
        const rawSnsLinks = req.body.snsLinks;

        if (rawSnsLinks) {
            // ⭐️ SNS 링크 파싱: 배열 -> 문자열 순서로 체크하여 JSON 요청 우선 처리
            if (Array.isArray(rawSnsLinks)) {
                // 1. JSON 요청 (express.json()에 의해 파싱된 배열 객체)
                snsLinks = rawSnsLinks;
            } else if (typeof rawSnsLinks === 'string') {
                // 2. Multipart 요청 (Multer에 의해 문자열로 전달된 경우)
                try {
                    snsLinks = JSON.parse(rawSnsLinks);
                } catch {
                    return res.status(400).json({ success: false, message: "SNS links must be a valid JSON array string." });
                }
            } else {
                return res.status(400).json({ success: false, message: "SNS links format is invalid or corrupted." });
            }

            // 파싱 결과가 배열이 아니면 400 에러 처리 (방어 로직)
            if (!Array.isArray(snsLinks)) {
                return res.status(400).json({ success: false, message: "SNS links must resolve to an array." });
            }

            // --- 최종 유효성 검사 ---
            if (
                !snsLinks.every(link => 
                    typeof link.id === "string" && link.id.length > 0 && 
                    typeof link.url === "string" && link.url.length > 0 && 
                    isValidUrl(link.url) 
                )
            ) {
                return res.status(400).json({ success: false, message: "Invalid SNS links data: Check ID, URL, or URL format (must include http/https)." });
            }
        }

        const file = req.file as Express.Multer.File | undefined;
        
        const settings = await settingsService.saveSettings(snsLinks, file);

        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("POST /settings 오류:", err);
        res.status(500).json({ success: false, message: `Failed to save settings: ${getErrorMessage(err)}` });
    }
};

export const deleteMainImage = async (req: Request, res: Response) => {
    try {
        const deleted = await settingsService.deleteMainImage();

        if (!deleted) {
            return res.status(200).json({ success: true, message: "삭제할 메인 이미지가 없습니다." });
        }

        res.status(200).json({ success: true, message: '메인 이미지 삭제 및 설정 업데이트 완료' });
    } catch (err) {
        console.error("DELETE /image 오류:", err);
        res.status(500).json({ success: false, message: `Failed to delete main image: ${getErrorMessage(err)}` });
    }
};