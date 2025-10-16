import { Request, Response } from 'express';
// ⭐️ 이 경로는 MariaDB/S3 기반의 새로운 profileService 파일을 바라봅니다.
import * as profileService from '../services/profileService';
import { MemberState } from '@/types/member';
import type { Express } from 'express'; // req.files 타입 명시를 위해 추가

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

/**
 * 프로필 생성 또는 업데이트
 */
export const createOrUpdateProfile = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const name = req.body.name as string;

        if (!name) {
            return res.status(400).json({ success: false, message: "name 필드는 필수입니다." });
        }

        // data 필드 처리: Multer form-data 요청 시 JSON 문자열로 넘어올 수 있음
        const data: MemberState = req.body.data
            ? typeof req.body.data === 'string'
                ? JSON.parse(req.body.data) // 문자열이면 파싱
                : req.body.data             // 이미 객체이면 그대로 사용
            : { text: [], image: [], sns: {} }; // data가 없으면 기본값 사용

        const files = req.files as Express.Multer.File[] | undefined;

        // profileService.saveProfile 함수 서명이 유지되어 그대로 호출 가능합니다.
        const result = await profileService.saveProfile(id, name, data, files);

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

/**
 * 프로필 조회
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const profile = await profileService.getProfileById(id);
        
        if (!profile) {
            return res.status(404).json({ success: false, message: "프로필을 찾을 수 없습니다." });
        }
        res.status(200).json({ success: true, data: profile });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};