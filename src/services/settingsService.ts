import pool from "@config/db-config";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { Express } from 'express'; 
import type { SnsLink, SettingsData } from "@/types/settings"; 
import { v4 as uuidv4 } from "uuid"; // UUID는 이제 사용하지 않지만, 임포트는 유지했습니다.

// ----------------------------------------------------
// 1. 타입 정의 및 헬퍼
// ----------------------------------------------------

// DB에서 반환되는 로우 타입 정의
interface SettingsRow extends RowDataPacket {
    id: number;
    mainImage: string | null;
    snsLinks: string | null; // JSON 문자열
    created_at: Date;
    updated_at: Date;
}

const TABLE_NAME = "settings";

// 💡 헬퍼 함수: S3 URL에서 키(Key)를 추출합니다. ('assets/images/' 경로 처리)
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        const path = urlParts.pathname.substring(1); 
        // 새 경로 'assets/images/'에 맞춰 수정
        return path.startsWith('assets/images/') ? path : null; 
    } catch (e) {
        return null;
    }
};

// ----------------------------------------------------
// 2. 서비스 함수
// ----------------------------------------------------

/**
 * 설정 조회 (id = 1 고정)
 */
export async function getSettings(): Promise<SettingsData> {
    const [rows] = await pool.execute<SettingsRow[]>(
        `SELECT id, mainImage, snsLinks FROM ${TABLE_NAME} WHERE id = 1`
    );

    if (rows.length === 0) {
        return { mainImage: "", snsLinks: [] };
    }

    const row = rows[0];
    
    // SNS 링크 JSON 문자열을 객체 배열로 파싱
    let snsLinks: SnsLink[] = [];
    if (row.snsLinks) {
        try {
            snsLinks = JSON.parse(row.snsLinks) as SnsLink[]; 
        } catch (e) {
            console.error("SNS Links JSON parsing error:", e);
        }
    }

    return {
        mainImage: row.mainImage || "",
        snsLinks: snsLinks,
    };
}

/**
 * 설정 저장/수정
 */
export async function saveSettings(
    snsLinks: SnsLink[], 
    file: Express.Multer.File | undefined
): Promise<SettingsData> {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        
        const currentSettings = await getSettings();
        let newMainImageUrl: string = currentSettings.mainImage || "";

        // 2. 새 파일 처리 (mainImage)
        if (file) {
            // 기존 이미지가 있다면 S3에서 삭제 (URL -> S3 Key 추출 후 삭제)
            if (currentSettings.mainImage) {
                const oldKey = extractS3Key(currentSettings.mainImage);
                if (oldKey) {
                    await deleteFromStorage(oldKey).catch(err => console.error("Old S3 deletion failed:", err));
                } else {
                     // 🚨 기존에 확장자가 없는 파일명으로 저장되었을 경우를 대비하여 한 번 더 시도
                     await deleteFromStorage(currentSettings.mainImage).catch(err => console.error("Old S3 deletion failed (direct URL):", err));
                }
            }
            
            if (!file.buffer || !file.mimetype) {
                throw new Error("File buffer or mimetype is missing for upload.");
            }
            
            // ⭐️ S3 Key 설정: 'assets/images/main'으로 고정하고 확장자 추가
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `assets/images/main.${mimeTypeExtension}`; 
            
            // S3 URL이 반환될 것으로 가정 (buffer, key, mimetype 순서)
            newMainImageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype); 
        }

        // 3. snsLinks 객체 배열을 JSON 문자열로 변환
        const snsLinksJson = JSON.stringify(snsLinks);
        
        // 4. DB에 UPSERT (id=1 고정 사용)
        await conn.execute<ResultSetHeader>(
        `
        INSERT INTO ${TABLE_NAME} (id, mainImage, snsLinks) VALUES (1, ?, ?)
        ON DUPLICATE KEY UPDATE
        mainImage = VALUES(mainImage),
        snsLinks = VALUES(snsLinks),
        updated_at = NOW()
        `, 
        [newMainImageUrl || null, snsLinksJson] 
        );

        await conn.commit();
        
        return {
            mainImage: newMainImageUrl,
            snsLinks: snsLinks
        };
    } catch (error) {
        await conn.rollback();
        console.error("saveSettings transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * 메인 이미지 삭제
 */
export async function deleteMainImage(): Promise<boolean> {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        
        const currentSettings = await getSettings();
        const imageUrl = currentSettings.mainImage;

        if (!imageUrl) {
            await conn.rollback();
            return false;
        }
        
        // 2. S3에서 파일 삭제 (URL -> S3 Key 추출 후 삭제)
        const s3Key = extractS3Key(imageUrl);
        if (s3Key) {
            await deleteFromStorage(s3Key).catch(err => console.error("S3 deletion failed:", err));
        } else {
             // 🚨 URL에서 Key 추출에 실패하면, URL 자체를 Key로 사용해 시도
             await deleteFromStorage(imageUrl).catch(err => console.error("S3 deletion failed (direct URL):", err));
        }

        // 3. DB 데이터 업데이트: mainImage 컬럼을 NULL로 업데이트
        const [result] = await conn.execute<ResultSetHeader>(
            `UPDATE ${TABLE_NAME} SET mainImage = NULL, updated_at = NOW() WHERE id = 1`,
        );

        await conn.commit();
        
        return result.affectedRows > 0;
    } catch (error) {
        await conn.rollback();
        console.error("deleteMainImage transaction failed:", error);
        throw error;
    } finally {
        conn.release();
    }
}