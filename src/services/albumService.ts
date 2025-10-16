import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "../config/db-config";
// ⭐️ AWS S3 버퍼 업로드 및 설정 파일 임포트
import { uploadBufferToStorage } from "../utils/aws-s3-upload";
import { s3, AWS_S3_BUCKET_NAME } from "../config/aws-s3"; 

// AWS SDK S3 삭제 명령어 임포트
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { AlbumItem } from "@/types/album";
import { v4 as uuidv4 } from "uuid";
// import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'; // 🚨 기존 오류: RowDataPacket은 위에 임포트됨
import type { Express } from 'express'; 
// Note: fs import is no longer needed since we use S3 buffer upload/delete

const TABLE_NAME = "albums"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의 (id는 숫자형, tracks는 JSON 문자열로 가정)
// ⭐️ DB 필드명: 'date' 대신 'release_date'를 사용한다고 가정합니다. ⭐️
interface AlbumRow extends Omit<AlbumItem, 'id' | 'tracks' | 'date'>, RowDataPacket {
    id: number; // DB의 Primary Key
    tracks: string; // JSON 문자열
    release_date: string; // DB의 실제 날짜 필드명
}

// 헬퍼 함수: DB Row를 AlbumItem 타입으로 변환 (숫자 ID -> 문자열, JSON -> 객체)
const mapRowToAlbumItem = (row: AlbumRow): AlbumItem => ({
    // ⭐️ DB의 release_date 필드를 AlbumItem의 date 필드로 매핑합니다. ⭐️
    ...row,
    id: String(row.id),
    date: row.release_date, 
    tracks: JSON.parse(row.tracks || '[]'),
});

// ----------------------------------------------------
// DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 전체 앨범 조회
 */
export async function getAlbums(): Promise<AlbumItem[]> {
    const [rows] = await pool.execute<AlbumRow[]>(
        // ⭐️ 'date' 대신 'release_date'로 정렬합니다 ⭐️
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
 * 앨범 생성
 */
export async function createAlbum(
    data: Partial<AlbumItem>,
    file?: Express.Multer.File
): Promise<AlbumItem> {
    if (!data.title || !data.date) throw new Error("Title and date are required");

    let imageUrl = "";
    if (file) {
        // AWS S3에 커버 이미지 업로드
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
    
    // JSON 직렬화
    const tracksJson = JSON.stringify(albumData.tracks);

    // ⭐️ 쿼리에서 'date' 대신 'release_date' 필드를 사용합니다 ⭐️
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (title, release_date, description, tracks, videoUrl, image) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [albumData.title, albumData.date, albumData.description, tracksJson, albumData.videoUrl, albumData.image]
    );

    const newId = String(result.insertId);
    return { ...albumData, id: newId };
}

/**
 * 앨범 수정
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
        // 기존 S3 이미지 삭제
        if (imageUrl) {
            await deleteS3File(imageUrl).catch(err => console.error("Old S3 deletion failed:", err));
        }

        // 새 이미지 업로드
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
        // ⭐️ 'date' 필드가 있다면 'release_date'로 매핑하여 DB에 전달합니다. ⭐️
        const dbKey = key === 'date' ? 'release_date' : key;
        
        if (key === 'tracks') {
            updateFields[dbKey] = JSON.stringify(value); // tracks는 JSON으로 직렬화
        } else {
            updateFields[dbKey] = value;
        }
    }
    updateFields.image = imageUrl; // 최종 이미지 URL 포함

    // SET 구문 생성
    const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateFields);

    // 4. MariaDB 업데이트
    await pool.execute(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`,
        [...values, id]
    );
    
    // 5. 업데이트된 데이터 조회 및 반환
    return getAlbumById(id);
}

/**
 * 앨범 삭제
 */
export async function deleteAlbum(id: string): Promise<void> {
    const album = await getAlbumById(id);
    if (!album) return;

    // 1. S3 이미지 삭제
    if (album.image) {
        await deleteS3File(album.image).catch(err => console.error("S3 deletion failed:", err));
    }

    // 2. MariaDB 데이터 삭제
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );
}

// ----------------------------------------------------
// 내부 헬퍼 함수
// ----------------------------------------------------

/**
 * AWS S3 파일 삭제 헬퍼
 */
async function deleteS3File(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    // ⭐️ 1. filePath를 try 블록 밖에서 미리 선언합니다.
    let filePath: string; 

    try {
        const urlObj = new URL(fileUrl);
        // const region = s3.config.region; // 이 줄은 S3 객체에 region이 없을 수 있어 제거
        
        // keyMatch를 찾는 로직은 S3 URL 구조에 따라 다릅니다. 이 코드가 정상 작동한다고 가정합니다.
        const keyMatch = fileUrl.match(new RegExp(`/${AWS_S3_BUCKET_NAME}/(.*)`));
        
        // ⭐️ 2. 선언된 filePath에 값을 할당합니다. (let 선언은 이미 외부에서 처리됨)
        filePath = keyMatch ? keyMatch[1] : urlObj.pathname.substring(1); 
        
        filePath = decodeURIComponent(filePath);

        const deleteParams = {
            Bucket: AWS_S3_BUCKET_NAME,
            Key: filePath, 
        };

        await s3.send(new DeleteObjectCommand(deleteParams));
    } catch (err) {
        const error = err instanceof Error ? err : new Error("An unknown S3 error occurred");
        throw new Error(`Failed to delete S3 file: ${error.message}`);
    }
}
