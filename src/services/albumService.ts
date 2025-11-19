import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload";
import type { AlbumItem } from "@/types/album"; 
import { v4 as uuidv4 } from "uuid";
import type { Express } from 'express'; 
import sharp from 'sharp';

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

// ⭐️ 헬퍼 함수: URL에서 쿼리 파라미터를 제거합니다.
const cleanImageUrl = (url: string): string => {
    return url.split('?')[0];
};

/**
 * ⭐️ 새 헬퍼 함수: ISO 8601 날짜 문자열을 DB용 YYYY-MM-DD 형식으로 변환
 */
const toDatabaseDate = (isoString: string): string => {
    // MySQL DATE 타입에 맞게 YYYY-MM-DD만 추출
    return new Date(isoString).toISOString().substring(0, 10);
};

// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들 (CRUD)
// ----------------------------------------------------

// ... (getAlbums 및 getAlbumById 함수는 변경 없음)

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
        
        // 1. S3에 커버 이미지 업로드 (Sharp를 이용한 리사이징 및 URL 클리닝 적용)
        if (file) {
            
            // 이미지 리사이징 로직 (360x280)
            const resizedBuffer = await sharp(file.buffer)
                .resize(360, 280, { fit: 'cover' })
                .toBuffer();
            
            const fileUUID = uuidv4();
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
            
            // 리사이징된 버퍼를 사용하여 S3에 업로드
            let uploadedUrl = await uploadBufferToStorage(resizedBuffer, destPath, file.mimetype);
            
            // DB에 저장하기 전에 URL에서 파라미터를 제거하여 순수한 S3 경로만 저장
            imageUrl = cleanImageUrl(uploadedUrl); 
        }
        
        // 2. DB 데이터 준비
        const newId = uuidv4(); 
        const tracksJson = JSON.stringify(data.tracks || []);
        
        // ⭐️ 날짜 형식 변환 적용 (생성 시에도 오류 방지)
        const dbDate = data.date ? toDatabaseDate(data.date) : '';
        
        // 3. DB INSERT
        await conn.execute<ResultSetHeader>(
            `INSERT INTO ${TABLE_NAME} 
             (id, title, date, description, tracks, videoUrl, image, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                newId, 
                data.title, 
                dbDate, // ⭐️ 변환된 날짜 사용
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
        
        // 2. 이미지 처리 및 S3 업로드/삭제 (Sharp를 이용한 리사이징 및 URL 클리닝 적용)
        if (file) {
            // 기존 S3 이미지 삭제
            if (imageUrl) {
                const oldKey = extractS3Key(imageUrl);
                if (oldKey) {
                    // 삭제 실패는 트랜잭션을 중단시키지 않음 (catch로 에러 처리)
                    await deleteFromStorage(oldKey).catch(err => console.error("Old S3 deletion failed:", err));
                }
            }
            
            // ⭐️ 이미지 리사이징 로직 및 resizedBuffer 선언/할당
            const resizedBuffer = await sharp(file.buffer) 
                .resize(360, 280, { fit: 'cover' })
                .toBuffer();

            // 새 이미지 업로드
            const fileUUID = uuidv4();
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `albums/${fileUUID}.${mimeTypeExtension}`;
            
            // resizedBuffer 사용
            let uploadedUrl = await uploadBufferToStorage(resizedBuffer, destPath, file.mimetype);
            
            // DB에 저장하기 전에 URL에서 파라미터를 제거하여 순수한 S3 경로만 저장
            imageUrl = cleanImageUrl(uploadedUrl);
        }

        // 3. 업데이트할 데이터 준비
        const updateFields: { [key: string]: any } = {};
        const allowedKeys: Array<keyof Omit<AlbumItem, 'id' | 'createdAt'>> = 
            ['title', 'date', 'description', 'tracks', 'videoUrl'];

        for (const key of allowedKeys) {
            if (key in data && data[key] !== undefined) {
                const value = data[key];
                
                // ⭐️ 핵심 수정: date 필드 변환 적용
                if (key === 'date' && typeof value === 'string') {
                    updateFields[key] = toDatabaseDate(value); // toDatabaseDate 헬퍼 사용
                } else if (key === 'tracks') {
                    updateFields[key] = JSON.stringify(value);
                } else {
                    updateFields[key] = value;
                }
            }
        }
        updateFields.image = imageUrl; // 최종 이미지 URL 포함

        // 4. MariaDB 업데이트
        const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateFields);

        if (setClauses.length === 0) {
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