import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { AlbumItem } from "@/types/album";
import { v4 as uuidv4 } from "uuid";

const TABLE_NAME = "album"; 

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB 로우 타입 정의
interface AlbumRow extends Omit<AlbumItem, 'id' | 'tracks' | 'date'>, RowDataPacket {
    id: number; 
    tracks: string; 
    release_date: string; // DB의 실제 날짜 필드명
}

// 헬퍼 함수: DB Row를 AlbumItem 타입으로 변환
const mapRowToAlbumItem = (row: AlbumRow): AlbumItem => ({
    ...row,
    id: String(row.id),
    date: row.release_date, 
    tracks: JSON.parse(row.tracks || '[]'),
});

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

/**
 * 전체 앨범 조회
 */
export async function getAlbums(): Promise<AlbumItem[]> {
    const [rows] = await pool.execute<AlbumRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY release_date DESC`
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

    let imageUrl = "";
    if (file) {
        // S3에 커버 이미지 업로드 (유틸리티 함수 사용)
        const fileUUID = uuidv4();
        const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
        const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
        imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
    }

    const albumData: Omit<AlbumItem, "id"> = {
        title: data.title,
        date: data.date,
        description: data.description || "",
        tracks: data.tracks || [],
        videoUrl: data.videoUrl || "",
        image: imageUrl,
    };
    
    const tracksJson = JSON.stringify(albumData.tracks);

    // DB INSERT: date 필드를 release_date로 매핑하여 사용
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (title, release_date, description, tracks, videoUrl, image) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [albumData.title, albumData.date, albumData.description, tracksJson, albumData.videoUrl, albumData.image]
    );

    const newId = String(result.insertId);
    return { ...albumData, id: newId };
}

/**
 * 앨범 수정 (DB 업데이트 및 S3 이미지 교체)
 */
export async function updateAlbum(
    id: string,
    data: Partial<AlbumItem>,
    file?: Express.Multer.File
): Promise<AlbumItem | null> {
    // 1. 기존 데이터 조회
    const existingAlbum = await getAlbumById(id);
    if (!existingAlbum) return null;

    let imageUrl = existingAlbum.image || "";
    
    // 2. 이미지 처리
    if (file) {
        // 기존 S3 이미지 삭제 (유틸리티 함수 사용)
        if (imageUrl) {
            await deleteFromStorage(imageUrl).catch(err => console.error("Old S3 deletion failed:", err));
        }

        // 새 이미지 업로드 (유틸리티 함수 사용)
        const fileUUID = uuidv4();
        const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
        const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
        imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
    }

    // 3. 업데이트할 데이터 준비
    const updateFields: { [key: string]: any } = {};
    const keysToUpdate = Object.keys(data).filter(key => key !== 'id');

    for (const key of keysToUpdate) {
        const value = data[key as keyof Partial<AlbumItem>];
        // date ↔ release_date 필드 매핑
        const dbKey = key === 'date' ? 'release_date' : key;
        
        if (key === 'tracks') {
            updateFields[dbKey] = JSON.stringify(value); // tracks는 JSON으로 직렬화
        } else {
            updateFields[dbKey] = value;
        }
    }
    updateFields.image = imageUrl; // 최종 이미지 URL 포함

    // 4. MariaDB 업데이트
    const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateFields);

    await pool.execute(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`,
        [...values, id]
    );
    
    // 5. 업데이트된 데이터 조회 및 반환
    return getAlbumById(id);
}

/**
 * 앨범 삭제 (DB 및 S3 파일 삭제)
 */
export async function deleteAlbum(id: string): Promise<void> {
    const album = await getAlbumById(id);
    if (!album) return;

    // 1. S3 이미지 삭제 (유틸리티 함수 사용)
    if (album.image) {
        await deleteFromStorage(album.image).catch(err => console.error("S3 deletion failed:", err));
    }

    // 2. MariaDB 데이터 삭제
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );
}

// ----------------------------------------------------
// 🚨 내부 헬퍼 함수 제거
// deleteS3File 함수는 이제 필요하지 않습니다.
// ----------------------------------------------------