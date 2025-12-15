import { Request, Response } from "express";
import * as galleryService from "@services/galleryService";
import type { Express } from "express";

// ----------------------------------------------------
// 헬퍼: 오류 메시지 추출
// ----------------------------------------------------
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// 갤러리 목록 조회
// ----------------------------------------------------
export const getGallery = async (_req: Request, res: Response) => {
    try {
        const items = await galleryService.getGalleryItems();
        return res.json({ success: true, data: items });
    } catch (err) {
        console.error("GET /gallery 오류:", err);
        return res.status(500).json({
            success: false,
            message: `Failed to fetch gallery: ${getErrorMessage(err)}`,
        });
    }
};

// ----------------------------------------------------
// 이미지 업로드
// ----------------------------------------------------
export const uploadGallery = async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[] | undefined;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded",
            });
        }

        const uploadedItems = await galleryService.uploadGalleryImages(files);

        return res.status(201).json({
            success: true,
            data: uploadedItems,
        });
    } catch (err) {
        console.error("POST /gallery 오류:", err);
        return res.status(500).json({
            success: false,
            message: `Upload failed: ${getErrorMessage(err)}`,
        });
    }
};

// ----------------------------------------------------
// 단일 이미지 삭제
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
                message: "Gallery item not found",
            });
        }

        return res.status(500).json({
            success: false,
            message: `Delete failed: ${message}`,
        });
    }
};

// ----------------------------------------------------
// 다중 이미지 삭제 (⭐️ 핵심 수정 포인트)
// ----------------------------------------------------
export const deleteMultipleGallery = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids?: string[] };

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No gallery IDs provided",
            });
        }

        // ⭐️ 반복 제거 — 서비스 레이어에 배열 그대로 위임
        const deletedIds = await galleryService.deleteMultipleGallery(ids);

        return res.json({
            success: true,
            deletedCount: deletedIds.length,
            deletedIds,
            message: `${deletedIds.length} items deleted successfully`,
        });
    } catch (err) {
        console.error("DELETE /gallery (multiple) 오류:", err);
        return res.status(500).json({
            success: false,
            message: `Delete multiple failed: ${getErrorMessage(err)}`,
        });
    }
};
