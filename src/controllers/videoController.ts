import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB 기반의 새로운 videoService 파일을 바라봅니다.
import * as videoService from "../services/videoService"; 

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
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, message: `Failed to fetch videos: ${getErrorMessage(err)}` });
    }
};

/**
 * 단일 영상 조회
 */
export const getVideoById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // videoService 함수는 이미 DB ID (숫자)를 문자열로 받고 처리합니다.
        const video = await videoService.getVideoById(id); 
        
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });
        res.status(200).json({ success: true, data: video });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to fetch video: ${getErrorMessage(err)}` });
    }
};

/**
 * 영상 등록
 */
export const createVideo = async (req: Request, res: Response) => {
    try {
        // req.body에서 title과 src를 가져오는 방식은 DB 변경과 무관하게 유지됩니다.
        const { title, src } = req.body; 
        if (!title || !src) {
            return res.status(400).json({ success: false, message: "Missing required fields (title or src)" });
        }

        // 💡 Note: createdAt 필드는 DB에서 NOW()로 처리할 수 있으나, 
        // 기존 서비스의 함수 시그니처를 유지하기 위해 컨트롤러에서 ISOString을 넘기는 방식도 유효합니다.
        // MariaDB 서비스 파일이 이 createdAt 값을 받아서 처리하도록 구현되어 있습니다.
        const createdAt = new Date().toISOString(); 
        const video = await videoService.createVideo({ title, src, createdAt });

        res.status(201).json({ success: true, data: video });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to create video: ${getErrorMessage(err)}` });
    }
};

/**
 * 영상 수정
 */
export const updateVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // req.body에 updatedAt이 자동 업데이트되도록 서비스에서 처리합니다.
        await videoService.updateVideo(id, req.body); 
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to update video: ${getErrorMessage(err)}` });
    }
};

/**
 * 영상 삭제
 */
export const deleteVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await videoService.deleteVideo(id);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to delete video: ${getErrorMessage(err)}` });
    }
};