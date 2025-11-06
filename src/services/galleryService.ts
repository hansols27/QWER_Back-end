import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config"; 
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { GalleryItem } from "@/types/gallery"; // GalleryItem은 id: string, url: string, createdAt: string을 가질 것으로 가정
import { v4 as uuidv4 } from "uuid";

const TABLE_NAME = "gallery"; 

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB 로우 타입 정의
// GalleryItem의 'id', 'createdAt' 필드는 DB에서 다르게 처리되므로 Omit 대상에 포함합니다.
interface GalleryRow extends Omit<GalleryItem, 'id' | 'createdAt'>, RowDataPacket {
    id: string; // DB의 VARCHAR(36)에 맞춰 string으로 수정
    createdAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
}

// 헬퍼 함수: DB Row를 GalleryItem 타입으로 변환
const mapRowToGalleryItem = (row: GalleryRow): GalleryItem => ({
    ...row,
    id: row.id,
    url: row.url,
    // DB의 Date 객체를 AlbumItem의 예상 타입인 string(ISO)으로 변환
    createdAt: row.createdAt.toISOString(), 
});

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

/**
 * 갤러리 목록 조회
 */
export const getGalleryItems = async (): Promise<GalleryItem[]> => {
    // createdAt 필드를 포함하여 조회
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
        const newId = uuidv4(); // 새 UUID 생성
        await pool.execute<ResultSetHeader>(
            // id를 직접 삽입하고, createdAt에 NOW() 사용
            `INSERT INTO ${TABLE_NAME} (id, url, createdAt) VALUES (?, ?, NOW())`,
            [newId, url]
        );
        
        // 삽입된 항목의 createdAt은 DB에서 조회해야 정확하지만, 
        // 서비스 코드가 간결함을 위해 임시로 현재 시각 사용
        // (정확히 하려면 getGalleryItemById(newId)를 호출해야 함)
        uploadedItems.push({ id: newId, url, createdAt: new Date().toISOString() });
    }

    return uploadedItems;
};

/**
 * 이미지 및 DB 데이터 삭제
 */
export const deleteGalleryImage = async (id: string): Promise<void> => {
    let fileUrl = "";

    // 🔹 1. MariaDB에서 이미지 URL 조회
    const [rows] = await pool.execute<GalleryRow[]>(
        // id는 VARCHAR이므로 String으로 조회
        `SELECT url FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) {
        throw new Error(`Gallery item not found: ${id}`);
    }
    fileUrl = rows[0].url;

    // 🔹 2. AWS S3에서 파일 삭제
    try {
        await deleteFromStorage(fileUrl);
    } catch (err) {
        console.error("Failed to delete file from S3:", fileUrl, err);
        // S3 삭제 실패해도 DB 데이터는 삭제 (로그 기록 후 진행)
    }

    // 🔹 3. MariaDB 문서 삭제
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
};