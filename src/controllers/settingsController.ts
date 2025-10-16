import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB/S3 기반의 새로운 settingsService 파일을 바라봅니다.
import * as settingsService from "../services/settingsService"; 
import type { SnsLink } from "@/types/settings";

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
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `Failed to fetch settings: ${getErrorMessage(err)}` });
    }
};

/**
 * 설정 저장
 */
export const saveSettings = async (req: Request, res: Response) => {
    try {
        let snsLinks: SnsLink[] = [];

        // SNS 링크 검증 (기존 로직 유지)
        if (req.body.snsLinks) {
            try {
                // req.body.snsLinks가 문자열로 넘어오므로 JSON.parse 필요 (Multer 사용 시 일반적인 패턴)
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

        const file = req.file;
        // settingsService.saveSettings 함수 서명이 유지되어 그대로 호출 가능합니다.
        const settings = await settingsService.saveSettings(snsLinks, file);

        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `Failed to save settings: ${getErrorMessage(err)}` });
    }
};