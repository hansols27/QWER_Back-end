import { Request, Response } from "express";
import * as galleryService from "../services/galleryService";

// 갤러리 목록 조회
export const getGallery = async (req: Request, res: Response) => {
  try {
    const items = await galleryService.getGalleryItems();
    res.json({ success: true, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch gallery" });
  }
};

// 이미지 업로드
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
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// 이미지 삭제
export const deleteGallery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await galleryService.deleteGalleryImage(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};
