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

// DB 로우 타입 정의
interface GalleryRow extends Omit<GalleryItem, 'id' | 'createdAt'>, RowDataPacket {
    id: string; // DB의 VARCHAR(36)
    createdAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
}

// 헬퍼 함수: DB Row를 GalleryItem 타입으로 변환
const mapRowToGalleryItem = (row: GalleryRow): GalleryItem => ({
    ...row,
    id: row.id,
    url: row.url,
    createdAt: row.createdAt.toISOString(), 
});

// 💡 S3 URL에서 키(Key)를 추출하는 헬퍼 함수 (deleteFromStorage에 전달하기 위해)
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        // path.substring(1)은 `/`를 제거
        const path = urlParts.pathname.substring(1); 
        // 갤러리 키가 'gallery/'로 시작하는지 확인 (선택 사항)
        return path.startsWith('gallery/') ? path : null;
    } catch (e) {
        return null;
    }
};

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

/**
 * 갤러리 목록 조회
 */
export const getGalleryItems = async (): Promise<GalleryItem[]> => {
    const [rows] = await pool.execute<GalleryRow[]>(
        `SELECT id, url, createdAt FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );

    return rows.map(mapRowToGalleryItem);
};

/**
 * 이미지 업로드 및 DB 등록
 */
export const uploadGalleryImages = async (files: Express.Multer.File[]): Promise<GalleryItem[]> => {
    if (!files || files.length === 0) return [];

    const uploadedItems: GalleryItem[] = [];
    const conn = await pool.getConnection(); // 💡 다중 파일 처리를 위해 트랜잭션 사용

    try {
        await conn.beginTransaction();

        for (const file of files) {
            // 파일 이름 및 경로 생성
            const fileUUID = uuidv4();
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const fileName = `gallery/${fileUUID}.${mimeTypeExtension}`; // S3 Key
            
            let url = "";

            // 🔹 1. AWS S3에 파일 업로드
            try {
                url = await uploadBufferToStorage(file.buffer, fileName, file.mimetype);
            } catch (err) {
                console.error("Failed to upload file to S3:", file.originalname, err);
                throw err; // S3 업로드 실패 시 전체 트랜잭션 롤백
            }

            // 🔹 2. MariaDB에 메타데이터 저장
            const newId = uuidv4(); // 새 UUID 생성
            await conn.execute<ResultSetHeader>( // conn.execute 사용
                `INSERT INTO ${TABLE_NAME} (id, url, createdAt) VALUES (?, ?, NOW())`,
                [newId, url]
            );
            
            // 삽입된 항목 반환 (createdAt은 임시로 현재 시각 사용)
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

/**
 * 다중 이미지 삭제
 * @param ids 삭제할 갤러리 ID 배열
 */
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
        const s3Key = fileUrl ? fileUrl.split("/").slice(-2).join("/") : null;

        if (s3Key) {
            try {
                await deleteFromStorage(s3Key);
            } catch (err) {
                console.error("Failed to delete file from S3:", s3Key, err);
            }
        }

        await conn.execute(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        console.error("deleteGallery transaction failed:", err);
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