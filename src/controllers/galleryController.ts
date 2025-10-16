import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB/S3 기반의 새로운 galleryService 파일을 바라봅니다.
import * as galleryService from "../services/galleryService";
import type { Express } from 'express'; // req.files 타입 명시를 위해 추가

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// 갤러리 목록 조회
// ----------------------------------------------------

export const getGallery = async (req: Request, res: Response) => {
    try {
        const items = await galleryService.getGalleryItems();
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `Failed to fetch gallery: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 이미지 업로드
// ----------------------------------------------------

export const uploadGallery = async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        const uploadedItems = await galleryService.uploadGalleryImages(files);
        res.json({ success: true, data: uploadedItems });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `Upload failed: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 이미지 삭제
// ----------------------------------------------------

export const deleteGallery = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await galleryService.deleteGalleryImage(id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        const message = getErrorMessage(err);
        
        // ⭐️ 404 에러 처리 추가 (서비스에서 "Gallery item not found" 에러를 던진다고 가정)
        if (message.includes("Gallery item not found")) {
             return res.status(404).json({ success: false, message: "Gallery item not found" });
        }

        // 500 에러 처리
        res.status(500).json({ success: false, message: `Delete failed: ${message}` });
    }
};