import { Request, Response } from 'express';
import * as profileService from '@services/profileService';
import type { MemberProfilePayload, MemberProfileState } from "@/types/member"; 
import type { Express } from 'express'; 

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

/**
 * 프로필 생성 또는 업데이트 (Upsert)
 * (이전 코드와 동일, createOrUpdateProfile 함수)
 */
export const createOrUpdateProfile = async (req: Request, res: Response) => {
    const id = req.params.id;
    let payload: MemberProfilePayload;

    try {
        if (!req.body.payload) {
            return res.status(400).json({ success: false, message: "Payload(프로필 데이터)가 누락되었습니다." });
        }
        
        payload = JSON.parse(req.body.payload); 
        
        if (payload.id !== id) {
            return res.status(400).json({ success: false, message: "URL ID와 Payload ID가 일치하지 않습니다." });
        }
        if (!payload.name) {
            return res.status(400).json({ success: false, message: "name 필드는 필수입니다." });
        }

        const isExisting = await profileService.getProfileById(id);
        const files = req.files as Express.Multer.File[] | undefined;

        await profileService.saveProfile(id, payload, files);

        const statusCode = isExisting ? 200 : 201; 

        res.status(statusCode).json({ success: true, message: isExisting ? `${payload.name} 프로필이 업데이트되었습니다.` : `${payload.name} 프로필이 생성되었습니다.` });
        
    } catch (err) {
        console.error("POST/PUT /members/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

/**
 * 프로필 조회 (GET /members/:id)
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        
        // 서비스 레이어에서 프로필 조회
        const profile: MemberProfileState | null = await profileService.getProfileById(id);
        
        if (!profile) {
            // 프로필이 없을 경우 404 반환
            return res.status(404).json({ success: false, message: "프로필을 찾을 수 없습니다." });
        }
        
        // 조회된 프로필 데이터를 200 OK와 함께 반환
        res.status(200).json({ success: true, data: profile });
        
    } catch (err) {
        console.error("GET /members/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};