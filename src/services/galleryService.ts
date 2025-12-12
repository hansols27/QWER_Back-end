import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload";
import type { GalleryItem } from "@/types/gallery";
import { v4 as uuidv4 } from "uuid";
import type { Express } from 'express';

const TABLE_NAME = "gallery";

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

interface GalleryRow extends Omit<GalleryItem, 'id' | 'createdAt'>, RowDataPacket {
    id: string;
    createdAt: Date;
}

const mapRowToGalleryItem = (row: GalleryRow): GalleryItem => ({
    ...row,
    id: row.id,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
});

// S3 URL에서 Key 추출
const extractS3Key = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.replace(/^\/+/, ''); // 앞 슬래시 제거
        return path.startsWith('gallery/') ? path : null;
    } catch (e) {
        console.warn('Failed to parse S3 URL:', url, e);
        return null;
    }
};

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

// 갤러리 목록 조회
export const getGalleryItems = async (): Promise<GalleryItem[]> => {
    const [rows] = await pool.execute<GalleryRow[]>(
        `SELECT id, url, createdAt FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );
    return rows.map(mapRowToGalleryItem);
};

// 이미지 업로드
export const uploadGalleryImages = async (files: Express.Multer.File[]): Promise<GalleryItem[]> => {
    if (!files || files.length === 0) return [];

    const uploadedItems: GalleryItem[] = [];
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        for (const file of files) {
            const fileUUID = uuidv4();
            const ext = file.mimetype.split('/').pop() || 'png';
            const fileName = `gallery/${fileUUID}.${ext}`;

            const url = await uploadBufferToStorage(file.buffer, fileName, file.mimetype);

            const newId = uuidv4();
            await conn.execute<ResultSetHeader>(
                `INSERT INTO ${TABLE_NAME} (id, url, createdAt) VALUES (?, ?, NOW())`,
                [newId, url]
            );

            uploadedItems.push({ id: newId, url, createdAt: new Date().toISOString() });
        }

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        console.error("uploadGalleryImages transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }

    return uploadedItems;
};

// --------------------
// 단일 이미지 삭제
// --------------------
export const deleteGallery = async (id: string): Promise<void> => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [rows] = await conn.execute<RowDataPacket[]>(
            `SELECT url FROM ${TABLE_NAME} WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            await conn.rollback();
            throw new Error(`Gallery item not found: ${id}`);
        }

        const fileUrl = rows[0].url;
        const s3Key = extractS3Key(fileUrl);

        if (s3Key) {
            try {
                console.log("Deleting S3 file:", s3Key);
                await deleteFromStorage(s3Key);
            } catch (err) {
                console.error("Failed to delete file from S3:", s3Key, err);
                // 필요 시 throw err;
            }
        } else {
            console.warn("S3 key not found for URL:", fileUrl);
        }

        await conn.execute(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        await conn.commit();

    } catch (err) {
        await conn.rollback();
        console.error("deleteGalleryById transaction failed:", err);
        throw err;
    } finally {
        conn.release();
    }
};

// --------------------
// 다중 이미지 삭제
// --------------------
export const deleteMultipleGallery = async (ids: string[]): Promise<string[]> => {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const deletedIds: string[] = [];

    for (const id of ids) {
        try {
            await deleteGallery(id);
            deletedIds.push(id);
        } catch (err) {
            const message = (err as Error).message;
            if (message.includes("Gallery item not found")) {
                console.warn(`Gallery item not found: ${id}`);
                continue;
            } else {
                console.error(`Error deleting ID ${id}:`, err);
                continue;
            }
        }
    }

    return deletedIds;
};
