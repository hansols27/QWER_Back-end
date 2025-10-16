import { Request, Response } from "express";
// ⭐️ 이 경로는 MariaDB/S3 기반의 새로운 albumService 파일을 바라봅니다.
import * as albumService from "../services/albumService";

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 타입 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------

export const getAlbums = async (req: Request, res: Response) => {
    try {
        const albums = await albumService.getAlbums();
        res.json({ success: true, data: albums });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 처리 안정화
        res.status(500).json({ success: false, message: `앨범 조회 실패: ${getErrorMessage(err)}` });
    }
};

export const getAlbum = async (req: Request, res: Response) => {
    try {
        const album = await albumService.getAlbumById(req.params.id);
        if (!album) return res.status(404).json({ success: false, message: "앨범을 찾을 수 없습니다." });
        res.json({ success: true, data: album });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 처리 안정화
        res.status(500).json({ success: false, message: `앨범 상세 조회 실패: ${getErrorMessage(err)}` });
    }
};

export const createAlbum = async (req: Request, res: Response) => {
    try {
        // 서비스 계층에서 유효성 검사 및 DB/S3 처리를 수행합니다.
        const album = await albumService.createAlbum(req.body, req.file);
        res.json({ success: true, data: album });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 처리 안정화
        res.status(500).json({ success: false, message: `앨범 생성 실패: ${getErrorMessage(err)}` });
    }
};

export const updateAlbum = async (req: Request, res: Response) => {
    try {
        const album = await albumService.updateAlbum(req.params.id, req.body, req.file);
        if (!album) return res.status(404).json({ success: false, message: "앨범을 찾을 수 없습니다." });
        res.json({ success: true, data: album });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 처리 안정화
        res.status(500).json({ success: false, message: `앨범 수정 실패: ${getErrorMessage(err)}` });
    }
};

export const deleteAlbum = async (req: Request, res: Response) => {
    try {
        // 서비스 계층에서 DB 데이터와 S3 파일을 모두 삭제합니다.
        await albumService.deleteAlbum(req.params.id);
        res.json({ success: true, message: "앨범 삭제 완료" });
    } catch (err) {
        console.error(err);
        const message = getErrorMessage(err);
        
        // ⭐️ 404 에러 처리 강화 (서비스에서 "not found" 에러를 던진다고 가정)
        if (message.includes("not found")) {
            return res.status(404).json({ success: false, message: "앨범을 찾을 수 없거나 이미 삭제되었습니다." });
        }
        
        // 500 에러 처리
        res.status(500).json({ success: false, message: `앨범 삭제 실패: ${message}` });
    }
};