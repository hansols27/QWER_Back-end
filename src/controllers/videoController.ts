import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB 기반의 새로운 videoService 파일을 바라봅니다.
import * as videoService from "@services/videoService"; 

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred";
};

/**
 * 전체 영상 조회
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
 * 단일 영상 조회
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
 * 영상 등록
 */
export const createVideo = async (req: Request, res: Response) => {
    try {
        const { title, src } = req.body; 
        if (!title || !src) {
            return res.status(400).json({ success: false, message: "Missing required fields (title or src)" });
        }

        // MariaDB 서비스에서 `createdAt` 처리를 전적으로 담당하도록 `createdAt` 전달을 제거할 수 있지만,
        // 기존 서비스 시그니처 유지를 위해 현재 로직을 유지합니다.
        const createdAt = new Date().toISOString(); 
        const video = await videoService.createVideo({ title, src, createdAt });

        res.status(201).json({ success: true, data: video });
    } catch (err) {
        console.error("POST /video 오류:", err);
        res.status(500).json({ success: false, message: `Failed to create video: ${getErrorMessage(err)}` });
    }
};

/**
 * 영상 수정
 */
export const updateVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // ⭐️ 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
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
 * 영상 삭제
 */
export const deleteVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // ⭐️ 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
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