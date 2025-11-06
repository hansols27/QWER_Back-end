import { Request, Response } from "express";
import * as videoService from "@services/videoService"; 

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred";
};

/**
 * 1. 전체 영상 조회 (GET /video)
 */
export const getVideos = async (req: Request, res: Response) => {
    try {
        const videos = await videoService.getVideos();
        res.status(200).json({ success: true, data: videos });
    } catch (err) {
        console.error("GET /video 오류:", err);
        res.status(500).json({ success: false, message: `Failed to fetch videos: ${getErrorMessage(err)}` });
    }
};

/**
 * 2. 단일 영상 조회 (GET /video/:id)
 */
export const getVideoById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; 
        const video = await videoService.getVideoById(id); 
        
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });
        res.status(200).json({ success: true, data: video });
    } catch (err) {
        console.error("GET /video/:id 오류:", err);
        res.status(500).json({ success: false, message: `Failed to fetch video: ${getErrorMessage(err)}` });
    }
};

/**
 * 3. 영상 등록 (POST /video)
 */
export const createVideo = async (req: Request, res: Response) => {
    try {
        const { title, src } = req.body; 
        if (!title || !src) {
            return res.status(400).json({ success: false, message: "Missing required fields (title or src)" });
        }

        // 🚨 타입 수정 반영: createdAt 필드 없이 title, src만 전달
        const video = await videoService.createVideo({ title, src });

        res.status(201).json({ success: true, data: video });
    } catch (err) {
        console.error("POST /video 오류:", err);
        res.status(500).json({ success: false, message: `Failed to create video: ${getErrorMessage(err)}` });
    }
};

/**
 * 4. 영상 수정 (PUT /video/:id)
 */
export const updateVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const affectedRows = await videoService.updateVideo(id, req.body); 
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("PUT /video/:id 오류:", err);
        res.status(500).json({ success: false, message: `Failed to update video: ${getErrorMessage(err)}` });
    }
};

/**
 * 5. 영상 삭제 (DELETE /video/:id)
 */
export const deleteVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const affectedRows = await videoService.deleteVideo(id);
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("DELETE /videos/:id 오류:", err);
        res.status(500).json({ success: false, message: `Failed to delete video: ${getErrorMessage(err)}` });
    }
};