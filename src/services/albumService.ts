import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload";
import type { AlbumItem } from "@/types/album"; // AlbumItem 타입은 id: string, date: string, tracks: any[], createdAt: string을 가질 것으로 가정
import { v4 as uuidv4 } from "uuid";

const TABLE_NAME = "album"; 

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB 로우 타입 정의
// AlbumItem의 'id', 'tracks', 'createdAt' 필드는 DB에서 다르게 처리되므로 Omit 대상에 포함합니다.
interface AlbumRow extends Omit<AlbumItem, 'id' | 'tracks' | 'createdAt'>, RowDataPacket { 
    id: string; // DB의 VARCHAR(36)
    date: string; // DB의 DATE 필드명
    tracks: string; // DB의 JSON 문자열
    createdAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
}

// 헬퍼 함수: DB Row를 AlbumItem 타입으로 변환
const mapRowToAlbumItem = (row: AlbumRow): AlbumItem => ({
    ...row,
    id: row.id,
    date: row.date,
    tracks: JSON.parse(row.tracks || '[]'),
    // DB의 Date 객체를 AlbumItem의 예상 타입인 string으로 변환
    createdAt: row.createdAt.toISOString(), 
});

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

    let imageUrl = "";
    if (file) {
        // S3에 커버 이미지 업로드 (유틸리티 함수 사용)
        const fileUUID = uuidv4();
        const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
        const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
        imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
    }
    
    // 1. UUID 생성 (DB의 VARCHAR 기본 키와 일치)
    const newId = uuidv4(); 

    const albumData: Omit<AlbumItem, "id"> = {
        title: data.title,
        date: data.date,
        description: data.description || "",
        tracks: data.tracks || [],
        videoUrl: data.videoUrl || "",
        image: imageUrl,
        createdAt: new Date().toISOString() // DB 삽입 후 조회할 때 사용될 값
    };
    
    const tracksJson = JSON.stringify(albumData.tracks);

    // 2. DB INSERT: id를 직접 삽입하고, date 필드 사용
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (id, title, date, description, tracks, videoUrl, image, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [newId, albumData.title, albumData.date, albumData.description, tracksJson, albumData.videoUrl, albumData.image]
    );

    // 3. 삽입된 데이터 조회 및 반환
    const createdAlbum = await getAlbumById(newId);
    if (!createdAlbum) {
        throw new Error("앨범 생성 후 조회에 실패했습니다.");
    }

    return createdAlbum;
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
    const keysToUpdate = Object.keys(data).filter(key => key !== 'id' && key !== 'createdAt');

    for (const key of keysToUpdate) {
        const value = data[key as keyof Partial<AlbumItem>];
        const dbKey = key; 
        
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