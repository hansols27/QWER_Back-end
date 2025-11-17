import pool from "@config/db-config";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { Express } from 'express'; 
import type { SnsLink, SettingsData } from "@/types/settings"; 

// ----------------------------------------------------
// 1. 타입 정의 (외부 파일 사용)
// ----------------------------------------------------

// DB에서 반환되는 로우 타입 정의 (DB 구조에 따라 필요)
interface SettingsRow extends RowDataPacket {
    id: number;
    mainImage: string | null;
    snsLinks: string | null; // JSON 문자열
    created_at: Date;
    updated_at: Date;
}

// ----------------------------------------------------
// 2. 서비스 함수
// ----------------------------------------------------

const TABLE_NAME = "settings";

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
            // 파싱된 객체가 SnsLink 타입임을 명시
            snsLinks = JSON.parse(row.snsLinks) as SnsLink[]; 
        } catch (e) {
            console.error("SNS Links JSON parsing error:", e);
        }
    }

    return {
        // DB에서 null이 와도 SettingsData 타입에 맞게 빈 문자열로 반환
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
        
        // 1. 현재 설정 불러오기
        const currentSettings = await getSettings();
        
        // ⭐️ TS2322 오류 해결: currentSettings.mainImage가 string이 아닐 경우 
        // || "" (빈 문자열)로 초기화하여 string 타입을 보장합니다.
        let newMainImageUrl: string = currentSettings.mainImage || "";

        // 2. 새 파일 처리 (mainImage)
        if (file) {
            // 기존 이미지가 있다면 S3에서 삭제 (deleteFromStorage 사용)
            if (currentSettings.mainImage) {
                await deleteFromStorage(currentSettings.mainImage);
            }
            
            // ⭐️ 새 이미지 업로드: uploadBufferToStorage 사용 (파일 버퍼 전달)
            if (!file.buffer || !file.mimetype) {
                throw new Error("File buffer or mimetype is missing for upload.");
            }
            // S3 URL이 반환될 것으로 가정
            newMainImageUrl = await uploadBufferToStorage(file.buffer, file.mimetype, file.originalname); 
        }

        // 3. snsLinks 객체 배열을 JSON 문자열로 변환
        const snsLinksJson = JSON.stringify(snsLinks);
        
        // 4. DB에 UPSERT (id=1 고정 사용)
        // 🚨 SQL 구문 오류 해결: 쿼리 내부의 불필요한 공백을 제거하고 깔끔하게 수정
        const [result] = await conn.execute<ResultSetHeader>(
        `
        INSERT INTO ${TABLE_NAME} (id, mainImage, snsLinks) VALUES (1, ?, ?)
        ON DUPLICATE KEY UPDATE
        mainImage = VALUES(mainImage),
        snsLinks = VALUES(snsLinks)
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
        
        // 1. 현재 설정 데이터 불러오기
        const currentSettings = await getSettings();
        const imageUrl = currentSettings.mainImage;

        if (!imageUrl) {
            await conn.rollback();
            return false;
        }

        // ⭐️ S3에서 파일 삭제 (deleteFromStorage 사용)
        await deleteFromStorage(imageUrl);

        // 3. DB 데이터 업데이트: mainImage 컬럼을 NULL로 업데이트
        const [result] = await conn.execute<ResultSetHeader>(
            `UPDATE ${TABLE_NAME} SET mainImage = NULL WHERE id = 1`,
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