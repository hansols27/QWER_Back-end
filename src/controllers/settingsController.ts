import { Request, Response } from "express";
import * as settingsService from "@services/settingsService"; 
import type { SnsLink } from "@/types/settings";
import type { Express } from "express"; // req.file 타입 명시를 위해 추가

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred";
};

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
 * 설정 저장
 */
export const saveSettings = async (req: Request, res: Response) => {
    try {
        let snsLinks: SnsLink[] = [];

        // SNS 링크 검증 및 파싱 (라우터의 Multer에서 넘어온 JSON 문자열 처리)
        if (req.body.snsLinks) {
            try {
                snsLinks = JSON.parse(req.body.snsLinks); 
                if (
                    !Array.isArray(snsLinks) ||
                    !snsLinks.every(link => typeof link.id === "string" && typeof link.url === "string")
                ) {
                    return res.status(400).json({ success: false, message: "Invalid SNS links format" });
                }
            } catch {
                return res.status(400).json({ success: false, message: "SNS links must be a valid JSON array" });
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

/**
 * ⭐️ 메인 이미지 삭제 (TS2339 오류 해결을 위해 추가)
 */
export const deleteMainImage = async (req: Request, res: Response) => {
    try {
        const deleted = await settingsService.deleteMainImage();

        if (!deleted) {
             // 서비스에서 삭제할 대상이 없었음을 알림
            return res.status(200).json({ success: true, message: "삭제할 메인 이미지가 없습니다." });
        }

        res.status(200).json({ success: true, message: '메인 이미지 삭제 및 설정 업데이트 완료' });
    } catch (err) {
        console.error("DELETE /settings/image 오류:", err);
        res.status(500).json({ success: false, message: `Failed to delete main image: ${getErrorMessage(err)}` });
    }
};