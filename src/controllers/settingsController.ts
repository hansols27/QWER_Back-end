import { Request, Response } from "express";
import * as settingsService from "../services/settingsService";
import type { SnsLink } from "@/types/settings";

/**
 * 설정 조회
 */
export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
};

/**
 * 설정 저장
 */
export const saveSettings = async (req: Request, res: Response) => {
  try {
    let snsLinks: SnsLink[] = [];

    // SNS 링크 검증
    if (req.body.snsLinks) {
      try {
        snsLinks = JSON.parse(req.body.snsLinks);
        if (
          !Array.isArray(snsLinks) ||
          !snsLinks.every(link => typeof link.id === "string" && typeof link.url === "string")
        ) {
          return res.status(400).json({ success: false, message: "Invalid SNS links format" });
        }
      } catch {
        return res.status(400).json({ success: false, message: "SNS links must be a valid JSON array" });
      }
    }

    const file = req.file;
    const settings = await settingsService.saveSettings(snsLinks, file);

    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save settings" });
  }
};
