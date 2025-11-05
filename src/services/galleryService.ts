import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config"; 
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { GalleryItem } from "@/types/gallery";
import { v4 as uuidv4 } from "uuid";
const TABLE_NAME = "gallery"; 

// DB 로우 타입 정의
interface GalleryRow extends Omit<GalleryItem, 'id'>, RowDataPacket {
    id: number; // DB의 Primary Key
}

// ----------------------------------------------------
// 갤러리 목록 조회
// ----------------------------------------------------

export const getGalleryItems = async (): Promise<GalleryItem[]> => {
    const [rows] = await pool.execute<GalleryRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );

    return rows.map((row) => ({ 
        id: String(row.id), 
        url: row.url, 
        createdAt: row.createdAt 
    }));
};

// ----------------------------------------------------
// 이미지 업로드 및 DB 등록
// ----------------------------------------------------

export const uploadGalleryImages = async (files: Express.Multer.File[]): Promise<GalleryItem[]> => {
    if (!files || files.length === 0) return [];

    const uploadedItems: GalleryItem[] = [];
    const now = new Date().toISOString();

    for (const file of files) {
        // 파일 이름 및 경로 생성
        const fileUUID = uuidv4();
        const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
        const fileName = `gallery/${fileUUID}.${mimeTypeExtension}`;
        
        let url = "";

        // 🔹 1. AWS S3에 파일 업로드 (유틸리티 함수 사용)
        try {
            url = await uploadBufferToStorage(file.buffer, fileName, file.mimetype);
        } catch (err) {
            console.error("Failed to upload file to S3:", file.originalname, err);
            continue;
        }

        // 🔹 2. MariaDB에 메타데이터 저장
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO ${TABLE_NAME} (url, createdAt) VALUES (?, ?)`,
            [url, now]
        );
        
        const newId = String(result.insertId);
        uploadedItems.push({ id: newId, url, createdAt: now });
    }

    return uploadedItems;
};

// ----------------------------------------------------
// 이미지 및 DB 데이터 삭제
// ----------------------------------------------------

export const deleteGalleryImage = async (id: string): Promise<void> => {
    let fileUrl = "";

    // 🔹 1. MariaDB에서 이미지 URL 조회
    const [rows] = await pool.execute<GalleryRow[]>(
        `SELECT url FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) {
        // 404 처리를 위해 명확한 에러를 던집니다.
        throw new Error(`Gallery item not found: ${id}`);
    }
    fileUrl = rows[0].url;

    // 🔹 2. AWS S3에서 파일 삭제 🚨 수정: 통합 유틸리티 함수 사용
    try {
        // deleteFromStorage가 S3 URL을 받아 Key를 추출하고 삭제까지 처리합니다.
        await deleteFromStorage(fileUrl);
    } catch (err) {
        console.error("Failed to delete file from S3:", fileUrl, err);
        // S3 삭제 실패해도 DB 데이터는 삭제
    }

    // 🔹 3. MariaDB 문서 삭제
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
};