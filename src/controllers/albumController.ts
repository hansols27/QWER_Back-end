import { Request, Response } from "express";
import * as albumService from "@services/albumService";
import type { Express } from 'express'; 

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 타입 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// 1. 앨범 목록 조회 (GET /albums)
// ----------------------------------------------------

export const getAlbums = async (req: Request, res: Response) => {
    try {
        const albums = await albumService.getAlbums();
        res.json({ success: true, data: albums });
    } catch (err) {
        console.error("GET /album 오류:", err);
        res.status(500).json({ success: false, message: `앨범 조회 실패: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 2. 앨범 상세 조회 (GET /albums/:id)
// ----------------------------------------------------

export const getAlbum = async (req: Request, res: Response) => {
    try {
        const album = await albumService.getAlbumById(req.params.id);
        if (!album) return res.status(404).json({ success: false, message: "앨범을 찾을 수 없습니다." });
        res.json({ success: true, data: album });
    } catch (err) {
        console.error("GET /album/:id 오류:", err);
        res.status(500).json({ success: false, message: `앨범 상세 조회 실패: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 3. 앨범 생성 (POST /albums)
// ----------------------------------------------------

export const createAlbum = async (req: Request, res: Response) => {
    try {
        const { title, date } = req.body;
        
        if (!title || !date) {
            return res.status(400).json({ success: false, message: "앨범 제목(title)과 발매일(date)은 필수 항목입니다." });
        }
        
        // ⭐️ req.file 타입 단언: Express.Multer.File 타입을 명시적으로 사용
        const file = req.file as Express.Multer.File | undefined;
        const album = await albumService.createAlbum(req.body, file);
        
        res.status(201).json({ success: true, data: album }); 
    } catch (err) {
        console.error("POST /album 오류:", err);
        res.status(500).json({ success: false, message: `앨범 생성 실패: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 4. 앨범 수정 (PUT /albums/:id)
// ----------------------------------------------------

export const updateAlbum = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        
        if (!id) {
            return res.status(400).json({ success: false, message: "수정할 앨범의 ID가 누락되었습니다." });
        }
        
        // ⭐️ req.file 타입 단언: Express.Multer.File 타입을 명시적으로 사용
        const file = req.file as Express.Multer.File | undefined;
        const album = await albumService.updateAlbum(id, req.body, file);
        
        if (!album) return res.status(404).json({ success: false, message: "앨범을 찾을 수 없습니다." });
        
        res.json({ success: true, data: album });
    } catch (err) {
        console.error("PUT /album/:id 오류:", err);
        res.status(500).json({ success: false, message: `앨범 수정 실패: ${getErrorMessage(err)}` });
    }
};

// ----------------------------------------------------
// 5. 앨범 삭제 (DELETE /albums/:id)
// ----------------------------------------------------

export const deleteAlbum = async (req: Request, res: Response) => {
    try {
        await albumService.deleteAlbum(req.params.id);
        res.json({ success: true, message: "앨범 삭제 완료" });
    } catch (err) {
        console.error("DELETE /album/:id 오류:", err);
        const message = getErrorMessage(err);
        
        if (message.includes("not found") || message.includes("Album not found")) {
            return res.status(404).json({ success: false, message: "앨범을 찾을 수 없거나 이미 삭제되었습니다." });
        }
        
        res.status(500).json({ success: false, message: `앨범 삭제 실패: ${message}` });
    }
};