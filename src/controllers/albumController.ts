import { Request, Response } from "express";
import * as albumService from "../services/albumService";

export const getAlbums = async (req: Request, res: Response) => {
  try {
    const albums = await albumService.getAlbums();
    res.json({ success: true, data: albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch albums" });
  }
};

export const getAlbum = async (req: Request, res: Response) => {
  try {
    const album = await albumService.getAlbumById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });
    res.json({ success: true, data: album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch album" });
  }
};

export const createAlbum = async (req: Request, res: Response) => {
  try {
    const album = await albumService.createAlbum(req.body, req.file);
    res.json({ success: true, data: album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create album" });
  }
};

export const updateAlbum = async (req: Request, res: Response) => {
  try {
    const album = await albumService.updateAlbum(req.params.id, req.body, req.file);
    if (!album) return res.status(404).json({ success: false, message: "Album not found" });
    res.json({ success: true, data: album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update album" });
  }
};

export const deleteAlbum = async (req: Request, res: Response) => {
  try {
    await albumService.deleteAlbum(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete album" });
  }
};
