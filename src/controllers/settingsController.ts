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

// URL 형식 유효성 검사 헬퍼 (http/https 시작 여부 확인 강화)
const isValidUrl = (url: string): boolean => {
    // 프론트엔드와 마찬가지로, http:// 또는 https://로 시작해야 유효하다고 간주합니다.
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
    }
    // URL 생성자를 이용한 형식 검사
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
            // ⭐️ 핵심 수정: rawSnsLinks의 타입에 따라 파싱 분기 처리 ⭐️
            if (Array.isArray(rawSnsLinks)) {
                // 1. JSON 요청 (express.json()에 의해 파싱된 배열 객체)
                snsLinks = rawSnsLinks;
            } else if (typeof rawSnsLinks === 'string') {
                // 2. Multipart 요청 (Multer에 의해 문자열로 전달된 경우)
                try {
                    snsLinks = JSON.parse(rawSnsLinks);
                } catch {
                    // 유효한 JSON 문자열이 아님
                    return res.status(400).json({ success: false, message: "SNS links must be a valid JSON array string." });
                }
            } else {
                // 3. 배열도 문자열도 아닌 유효하지 않은 형태
                return res.status(400).json({ success: false, message: "SNS links format is invalid or corrupted." });
            }

            // 파싱 결과가 배열이 아니면 400 에러 처리 (방어 로직)
            if (!Array.isArray(snsLinks)) {
                return res.status(400).json({ success: false, message: "SNS links must resolve to an array." });
            }

            // --- 최종 유효성 검사 ---
            if (
                !snsLinks.every(link => 
                    // ID와 URL이 문자열이고 비어있지 않으며
                    typeof link.id === "string" && link.id.length > 0 && 
                    typeof link.url === "string" && link.url.length > 0 && 
                    // URL 형식이 유효한지 확인
                    isValidUrl(link.url) 
                )
            ) {
                return res.status(400).json({ success: false, message: "Invalid SNS links data: Check ID, URL, or URL format (must include http/https)." });
            }
        }

        const file = req.file as Express.Multer.File | undefined;
        
        // 파일과 SNS 링크를 서비스 레이어로 전달
        const settings = await settingsService.saveSettings(snsLinks, file);

        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("POST /settings 오류:", err);
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
            return res.status(200).json({ success: true, message: "삭제할 메인 이미지가 없습니다." });
        }

        res.status(200).json({ success: true, message: '메인 이미지 삭제 및 설정 업데이트 완료' });
    } catch (err) {
        console.error("DELETE /image 오류:", err);
        res.status(500).json({ success: false, message: `Failed to delete main image: ${getErrorMessage(err)}` });
    }
};