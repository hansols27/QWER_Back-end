import { Request, Response } from "express";
import * as videoService from "../services/videoService";

/**
 * 전체 영상 조회
 */
export const getVideos = async (req: Request, res: Response) => {
  try {
    const videos = await videoService.getVideos();
    res.status(200).json({ success: true, data: videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch videos" });
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
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch video" });
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

    const createdAt = new Date().toISOString();
    const video = await videoService.createVideo({ title, src, createdAt });

    res.status(201).json({ success: true, data: video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create video" });
  }
};

/**
 * 영상 수정
 */
export const updateVideo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await videoService.updateVideo(id, req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update video" });
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
    res.status(500).json({ success: false, message: "Failed to delete video" });
  }
};
