import pool from "@config/db-config";
import { uploadBufferToStorage, deleteFromStorage } from '@utils/aws-s3-upload'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Express } from 'express';
// import { v4 as uuidv4 } from 'uuid'; // 💡 고유 파일명을 위해 필요할 수 있습니다.

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

// DB에서 반환될 로우 타입 정의
interface MemberRow extends RowDataPacket {
    id: string; 
    name: string; 
    text_contents: string; // JSON 문자열 (texts)
    image_urls: string;    // JSON 문자열 (images)
    sns: string;           // JSON 문자열 (snslinks)
}

// 헬퍼 함수: S3 URL에서 키 추출
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        // path.substring(1)은 `/`를 제거
        const path = urlParts.pathname.substring(1); 
        // 키가 'members/'로 시작하는지 확인
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
    // SELECT 쿼리 수정: contents 대신 text_contents와 image_urls 조회
    const [rows] = await pool.execute<MemberRow[]>(
        `SELECT id, name, text_contents, image_urls, sns FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );

    if (rows.length === 0) return null;
    const row = rows[0];

    try {
        // 텍스트, 이미지, SNS 링크를 분리된 컬럼에서 JSON 파싱
        const texts: TextItem[] = row.text_contents ? JSON.parse(row.text_contents) : []; 
        const images: APIImageItem[] = row.image_urls ? JSON.parse(row.image_urls) : [];
        const snslinks: SNSLinkItem[] = row.sns ? JSON.parse(row.sns) : [];

        // 💡 타입 캐스팅 제거 및 정리 (MemberProfileState의 type 필드가 id와 동일하다고 가정)
        const profile: MemberProfileState = {
            id: row.id, 
            name: row.name, 
            type: row.id, // type 필드가 id와 동일한 값을 가진다고 가정
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
 * @param payload 프론트엔드로부터 받은 MemberProfilePayload
 * @param files Multer로 받은 이미지 파일 목록
 */
export const saveProfile = async (
    id: string,
    payload: MemberProfilePayload,
    files?: Express.Multer.File[]
): Promise<void> => {

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 🔹 1. 기존 프로필 정보 로드
        const existingProfile = await getProfileById(id);
        const existingImageUrls = existingProfile 
            ? existingProfile.images.map(item => item.url)
            : [];
        
        const finalImages: APIImageItem[] = []; 
        let fileIndex = 0; 

        // 🔹 2. 신규 파일 처리 및 S3 업로드
        for (const item of payload.images) {
            if (item.url === "file_placeholder" && files && fileIndex < files.length) {
                const file = files[fileIndex];
                
                // 💡 UUID 사용으로 파일명 중복 가능성 낮춤 (uuidv4()가 임포트되어 있다고 가정)
                // const fileUUID = uuidv4();
                const fileUUID = new Date().getTime(); // 기존 로직 유지
                
                const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
                const destPath = `members/${id}/${fileUUID}.${mimeTypeExtension}`; 
                
                // S3 업로드
                const newUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
                finalImages.push({ id: item.id, url: newUrl }); 
                fileIndex++;
            } else if (item.url) {
                // 기존 URL 또는 유효한 URL은 그대로 유지
                finalImages.push(item);
            }
        }

        // 🔹 3. 삭제된 S3 파일 정리
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
        
        // 🔹 4. MariaDB 저장을 위한 최종 데이터 구성 (JSON 문자열화)
        // Note: payload.texts와 payload.snslinks는 TextItem[] 및 SNSLinkItem[]입니다.
        const textContentsJsonString = JSON.stringify(payload.texts); 
        const imageUrlsJsonString = JSON.stringify(finalImages); // S3 URL 포함된 최종 이미지 목록
        const snsJsonString = JSON.stringify(payload.snslinks);

        // 🔹 5. MariaDB 저장 (Upsert)
        // 🚨 쿼리 수정: contents 대신 text_contents와 image_urls 사용
        await conn.execute<ResultSetHeader>(
            `
            INSERT INTO ${TABLE_NAME} (id, name, text_contents, image_urls, sns) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                name = VALUES(name), 
                text_contents = VALUES(text_contents), 
                image_urls = VALUES(image_urls),
                sns = VALUES(sns)
            `,
            // 🚨 인자 순서: id, payload.name, text JSON, image JSON, sns JSON
            [id, payload.name, textContentsJsonString, imageUrlsJsonString, snsJsonString]
        );

        await conn.commit();
        
    } catch (error) {
        await conn.rollback();
        console.error("saveProfile transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
};