// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "../config/db-config"; 
// ⭐️ AWS S3 버퍼 업로드 및 설정 파일 임포트
import { uploadBufferToStorage } from "../utils/aws-s3-upload";
import { s3, AWS_S3_BUCKET_NAME } from "../config/aws-s3"; 

// AWS SDK S3Client 및 삭제 명령어 임포트
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { GalleryItem } from "@/types/gallery";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Express } from 'express';

const TABLE_NAME = "gallery"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의 (id는 숫자형, Date 필드는 문자열로 가정)
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

    // DB의 숫자 ID를 문자열로 변환하여 반환
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
        // 파일 이름 및 경로 생성 (gallery/UUID.ext)
        const fileUUID = uuidv4();
        const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
        const fileName = `gallery/${fileUUID}.${mimeTypeExtension}`;
        
        let url = "";

        // 🔹 1. AWS S3에 파일 업로드
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
        throw new Error("Gallery item not found");
    }
    fileUrl = rows[0].url;

    // 🔹 2. AWS S3에서 파일 삭제
    try {
        // S3 URL에서 키(Key) 추출
        // URL 예: https://bucket-name.s3.region.amazonaws.com/gallery/uuid.png
        // Key는 'gallery/uuid.png' 입니다.
        // `s3.config.region`은 PromiseClient의 경우 `config.region.toString()`이 필요할 수 있으나, 
        // 여기서는 기본 리전 정보를 사용하여 파싱합니다.
        const region = s3.config.region; // S3Client의 region 접근
        const urlPartBase = `/${AWS_S3_BUCKET_NAME}.s3.${region}.amazonaws.com/`;

        // URL 파싱 로직 개선: Key가 URL의 마지막 부분이므로, 이를 디코딩하여 사용
        const urlObj = new URL(fileUrl);
        // pathname에서 버킷 이름 다음의 경로(Key)를 추출합니다.
        // URL이 'https://[버킷명].s3.[리전].amazonaws.com/gallery/uuid.png' 형식이므로,
        // pathname은 '/gallery/uuid.png' 형태일 수 있습니다.
        // 하지만 URL 인코딩 문제로 인해, Key를 더 안전하게 추출하는 것이 좋습니다.
        
        // 간단한 방법: Key는 URL에서 버킷 경로 다음의 경로입니다.
        const keyMatch = fileUrl.match(new RegExp(`/${AWS_S3_BUCKET_NAME}/(.*)`));
        let filePath = keyMatch ? keyMatch[1] : urlObj.pathname.substring(1); 
        
        // URL 인코딩된 문자열을 디코딩
        filePath = decodeURIComponent(filePath);

        const deleteParams = {
            Bucket: AWS_S3_BUCKET_NAME,
            Key: filePath,
        };

        await s3.send(new DeleteObjectCommand(deleteParams));

    } catch (err) {
        console.error("Failed to delete file from S3:", fileUrl, err);
        // S3 삭제 실패해도 DB 데이터는 삭제하여 유효하지 않은 URL이 남지 않도록 함
    }

    // 🔹 3. MariaDB 문서 삭제
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
};