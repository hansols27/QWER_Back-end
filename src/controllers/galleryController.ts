import { Request, Response } from "express";
import * as galleryService from "@services/galleryService";
import type { Express } from 'express'; 
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
        console.error("GET /gallery 오류:", err);
        res.status(500).json({ success: false, message: `Failed to fetch gallery: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 이미지 업로드
// ----------------------------------------------------

export const uploadGallery = async (req: Request, res: Response) => {
    try {
        // Multer 미들웨어를 통해 req.files에 Express.Multer.File[] 타입으로 파일이 들어옵니다.
        const files = req.files as Express.Multer.File[] | undefined; 
        
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        const uploadedItems = await galleryService.uploadGalleryImages(files);
        
        // 🚨 생성 성공 시 201 Created 응답으로 변경
        res.status(201).json({ success: true, data: uploadedItems });
    } catch (err) {
        console.error("POST /gallery 오류:", err);
        res.status(500).json({ success: false, message: `Upload failed: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 이미지 삭제
// ----------------------------------------------------

export const deleteGallery = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await galleryService.deleteGallery(id);

        return res.json({
            success: true,
            message: "Gallery item deleted successfully",
            deletedId: id,
        });
    } catch (err) {
        console.error("DELETE /gallery/:id 오류:", err);
        const message = getErrorMessage(err);

        if (message.includes("Gallery item not found")) {
            return res.status(404).json({
                success: false,
                message: "Gallery item not found"
            });
        }

        return res.status(500).json({
            success: false,
            message: `Delete failed: ${message}`
        });
    }
};

export const deleteMultipleGallery = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No gallery IDs provided"
            });
        }

        const deletedResults: string[] = [];

        for (const id of ids) {
            try {
                await galleryService.deleteMultipleGallery(id);
                deletedResults.push(id);
            } catch (err) {
                const msg = getErrorMessage(err);

                // 없는 ID일 경우, 404 반환 대신 스킵하고 계속 진행
                if (msg.includes("Gallery item not found")) {
                    console.warn(`Gallery item not found: ${id}`);
                    continue;
                } else {
                    console.error(`Error deleting ID ${id}:`, msg);
                    // 단일 실패는 전체 실패로 처리하지 않음
                    continue;
                }
            }
        }

        return res.json({
            success: true,
            deletedCount: deletedResults.length,
            deletedIds: deletedResults,
            message: `${deletedResults.length} items deleted successfully`
        });

    } catch (err) {
        console.error("DELETE /gallery (multiple) 오류:", err);
        const message = getErrorMessage(err);

        return res.status(500).json({
            success: false,
            message: `Delete multiple failed: ${message}`
        });
    }
};
