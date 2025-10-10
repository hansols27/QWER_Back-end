import { Request, Response } from 'express';
import * as profileService from '../services/profileService';
import { MemberState } from '@/types/member';

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

    const data: MemberState = req.body.data
      ? typeof req.body.data === 'string'
        ? JSON.parse(req.body.data)
        : req.body.data
      : { text: [], image: [], sns: {} };

    const files = req.files as Express.Multer.File[] | undefined;

    const result = await profileService.saveProfile(id, name, data, files);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: (err as Error).message });
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
    res.status(500).json({ success: false, error: (err as Error).message });
  }
};
