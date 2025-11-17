import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload";
import type { AlbumItem } from "@/types/album"; 
import { v4 as uuidv4 } from "uuid";
import type { Express } from 'express'; // Multer File 타입 사용을 위해 임포트

const TABLE_NAME = "album"; 

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB 로우 타입 정의
interface AlbumRow extends Omit<AlbumItem, 'id' | 'tracks' | 'createdAt'>, RowDataPacket { 
    id: string;
    date: string; 
    tracks: string; // DB의 JSON 문자열
    createdAt: Date; 
}

// 헬퍼 함수: DB Row를 AlbumItem 타입으로 변환
const mapRowToAlbumItem = (row: AlbumRow): AlbumItem => ({
    ...row,
    id: row.id,
    date: row.date,
    tracks: JSON.parse(row.tracks || '[]'),
    createdAt: row.createdAt.toISOString(), 
});

// 💡 헬퍼 함수: S3 URL에서 키(Key)를 추출합니다.
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        const path = urlParts.pathname.substring(1); 
        return path.startsWith('albums/') ? path : null;
    } catch (e) {
        return null;
    }
};

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

/**
 * 전체 앨범 조회
 */
export async function getAlbums(): Promise<AlbumItem[]> {
    const [rows] = await pool.execute<AlbumRow[]>(
        `SELECT id, title, date, image, description, videoUrl, tracks, createdAt FROM ${TABLE_NAME} ORDER BY date DESC`
    );
    return rows.map(mapRowToAlbumItem);
}

/**
 * 단일 앨범 조회
 */
export async function getAlbumById(id: string): Promise<AlbumItem | null> {
    const [rows] = await pool.execute<AlbumRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );
    if (rows.length === 0) return null;
    return mapRowToAlbumItem(rows[0]);
}

/**
 * 앨범 생성 (DB 및 S3 업로드)
 */
export async function createAlbum(
    data: Partial<AlbumItem>,
    file?: Express.Multer.File
): Promise<AlbumItem> {
    if (!data.title || !data.date) throw new Error("Title and date are required");

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        let imageUrl = "";
        
        // 1. S3에 커버 이미지 업로드
        if (file) {
            const fileUUID = uuidv4();
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
            imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
        }
        
        // 2. DB 데이터 준비
        const newId = uuidv4(); 
        const tracksJson = JSON.stringify(data.tracks || []);
        
        // 3. DB INSERT
        await conn.execute<ResultSetHeader>(
            `INSERT INTO ${TABLE_NAME} 
             (id, title, date, description, tracks, videoUrl, image, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                newId, 
                data.title, 
                data.date, 
                data.description || "", 
                tracksJson, 
                data.videoUrl || "", 
                imageUrl
            ]
        );

        await conn.commit();
        
        // 4. 삽입된 데이터 조회 및 반환
        const createdAlbum = await getAlbumById(newId);
        if (!createdAlbum) {
            throw new Error("앨범 생성 후 조회에 실패했습니다.");
        }

        return createdAlbum;
    } catch (error) {
        await conn.rollback();
        console.error("createAlbum transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * 앨범 수정 (DB 업데이트 및 S3 이미지 교체)
 */
export async function updateAlbum(
    id: string,
    data: Partial<AlbumItem>,
    file?: Express.Multer.File
): Promise<AlbumItem | null> {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        
        // 1. 기존 데이터 조회
        const existingAlbum = await getAlbumById(id);
        if (!existingAlbum) {
            await conn.rollback();
            return null;
        }

        let imageUrl = existingAlbum.image || "";
        
        // 2. 이미지 처리 및 S3 업로드/삭제
        if (file) {
            // 기존 S3 이미지 삭제
            if (imageUrl) {
                const oldKey = extractS3Key(imageUrl);
                if (oldKey) {
                    await deleteFromStorage(oldKey).catch(err => console.error("Old S3 deletion failed:", err));
                }
            }

            // 새 이미지 업로드
            const fileUUID = uuidv4();
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
            imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
        }

        // 3. 업데이트할 데이터 준비
        const updateFields: { [key: string]: any } = {};
        const allowedKeys: Array<keyof Omit<AlbumItem, 'id' | 'createdAt'>> = 
            ['title', 'date', 'description', 'tracks', 'videoUrl'];

        for (const key of allowedKeys) {
            if (key in data && data[key] !== undefined) {
                const value = data[key];
                updateFields[key] = key === 'tracks' ? JSON.stringify(value) : value;
            }
        }
        updateFields.image = imageUrl; // 최종 이미지 URL 포함

        // 4. MariaDB 업데이트
        const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateFields);

        if (setClauses.length === 0) { // 업데이트할 내용이 없으면 (이미지만 교체되지 않았다면)
            await conn.rollback();
            return existingAlbum;
        }

        await conn.execute<ResultSetHeader>(
            `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`,
            [...values, id]
        );
        
        await conn.commit();
        
        // 5. 업데이트된 데이터 조회 및 반환
        return getAlbumById(id);
    } catch (error) {
        await conn.rollback();
        console.error("updateAlbum transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * 앨범 삭제 (DB 및 S3 파일 삭제)
 */
export async function deleteAlbum(id: string): Promise<void> {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const album = await getAlbumById(id);
        if (!album) {
            await conn.rollback();
            return;
        }

        // 1. S3 이미지 삭제
        if (album.image) {
            const s3Key = extractS3Key(album.image);
            if (s3Key) {
                await deleteFromStorage(s3Key).catch(err => console.error("S3 deletion failed:", err));
            }
        }

        // 2. MariaDB 데이터 삭제
        await conn.execute<ResultSetHeader>(
            `DELETE FROM ${TABLE_NAME} WHERE id = ?`,
            [id]
        );
        
        await conn.commit();
        
    } catch (error) {
        await conn.rollback();
        console.error("deleteAlbum transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
}