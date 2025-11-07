import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from '@utils/aws-s3-upload'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Express } from 'express';

// ======================================================================
// 📌 프론트엔드 타입 정의 
// ======================================================================
import type { 
    TextItem, 
    ImageItem as APIImageItem, 
    SNSLinkItem, 
    MemberProfileState, 
    MemberProfilePayload 
} from "@/types/member"; 

// ======================================================================
// 📌 상수 및 타입 정의
// ======================================================================
const TABLE_NAME = "members"; 

// DB에서 반환될 로우 타입 정의 (🚨 DB 구조 변경: contents 제거, text_contents/image_urls 추가)
interface MemberRow extends RowDataPacket {
    id: string; 
    name: string; 
    text_contents: string; // JSON 문자열 (texts)
    image_urls: string;    // JSON 문자열 (images)
    sns: string;           // JSON 문자열 (snslinks)
}

// 헬퍼 함수: extractS3Key는 동일하게 유지
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        const path = urlParts.pathname.substring(1); 
        return path.startsWith('members/') ? path : null;
    } catch (e) {
        return null;
    }
};

// ----------------------------------------------------
// DB 조회 (GET) - MemberProfileState 형식으로 반환
// ----------------------------------------------------

/**
 * MariaDB에서 프로필 조회
 * @param id 멤버 ID
 * @returns MemberProfileState 객체 또는 null
 */
export const getProfileById = async (id: string): Promise<MemberProfileState | null> => {
    // 🚨 SELECT 쿼리 수정: contents 대신 text_contents와 image_urls 조회
    const [rows] = await pool.execute<MemberRow[]>(
        `SELECT id, name, text_contents, image_urls, sns FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );

    if (rows.length === 0) return null;
    const row = rows[0];

    try {
        // 🚨 텍스트와 이미지를 분리된 컬럼에서 JSON 파싱
        const texts: TextItem[] = row.text_contents ? JSON.parse(row.text_contents) : []; 
        const images: APIImageItem[] = row.image_urls ? JSON.parse(row.image_urls) : [];
        const snslinks: SNSLinkItem[] = row.sns ? JSON.parse(row.sns) : [];

        const profile: MemberProfileState = {
            id: row.id as any,
            name: row.name, 
            type: row.id as any, 
            texts: texts,
            images: images,
            snslinks: snslinks,
        };
        return profile;
    } catch (e) {
        console.error("Error parsing DB JSON for profile:", e);
        return null;
    }
};

// ----------------------------------------------------
// DB/S3 저장 및 업데이트 (UPSERT)
// ----------------------------------------------------

/**
 * Admin에서 받은 상태(MemberProfilePayload)를 기반으로 저장 (Upsert)
 * @param id 멤버 ID
 * @param payload 프론트엔드로부터 받은 MemberProfilePayload (Member ID, Name 포함)
 * @param files Multer로 받은 이미지 파일 목록
 */
export const saveProfile = async (
    id: string,
    payload: MemberProfilePayload,
    files?: Express.Multer.File[]
): Promise<void> => {

    // 🔹 1~3 단계: S3 파일 처리 (로직 동일)
    const existingProfile = await getProfileById(id);
    const existingImageUrls = existingProfile 
        ? existingProfile.images.map(item => item.url)
        : [];
    
    const finalImages: APIImageItem[] = []; 
    let fileIndex = 0; 

    for (const item of payload.images) {
        if (item.url === "file_placeholder" && files && fileIndex < files.length) {
            const file = files[fileIndex];
            const fileUUID = new Date().getTime() + '-' + file.originalname; 
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `members/${id}/${fileUUID}.${mimeTypeExtension}`; 
            
            const newUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
            finalImages.push({ id: item.id, url: newUrl }); 
            fileIndex++;
        } else if (item.url) {
            finalImages.push(item);
        }
    }

    const currentUrls = finalImages.map(img => img.url);
    for (const oldUrl of existingImageUrls) {
        if (!currentUrls.includes(oldUrl)) { 
            try {
                const oldKey = extractS3Key(oldUrl);
                if (oldKey) { 
                    await deleteFromStorage(oldKey);
                    console.log(`[S3 DELETE] Deleted old profile image: ${oldKey}`);
                }
            } catch (e) {
                console.error(`Error extracting/deleting old S3 key: ${oldUrl}`, e);
            }
        }
    }
    
    // 🔹 4. MariaDB 저장을 위한 최종 데이터 구성
    const dbTexts = payload.texts;
    const dbImages = finalImages.filter(img => img.url.length > 0);
    const dbSnsLinks = payload.snslinks;
    
    // 🚨 텍스트와 이미지를 분리된 JSON 문자열로 만듭니다.
    // 텍스트는 TextItem[] 그대로 저장
    const textContentsJsonString = JSON.stringify(dbTexts); 
    // 이미지는 APIImageItem[] 그대로 저장
    const imageUrlsJsonString = JSON.stringify(dbImages); 
    
    const snsJsonString = JSON.stringify(dbSnsLinks);

    // 🔹 5. MariaDB 저장 (Upsert)
    await pool.execute<ResultSetHeader>(
        // 🚨 쿼리 수정: contents 대신 text_contents와 image_urls 사용
        `INSERT INTO ${TABLE_NAME} (id, name, text_contents, image_urls, sns) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            name = VALUES(name), 
            text_contents = VALUES(text_contents), 
            image_urls = VALUES(image_urls),
            sns = VALUES(sns)`,
        // 🚨 인자 순서 수정: id, payload.name, text JSON, image JSON, sns JSON
        [id, payload.name, textContentsJsonString, imageUrlsJsonString, snsJsonString]
    );
};