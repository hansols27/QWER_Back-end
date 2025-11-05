// ⭐️ DB 연결 풀 임포트
import pool from "@config/db-config"; 
// ⭐️ AWS S3 버퍼 업로드 및 삭제 함수 임포트
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { SettingsData, SnsLink } from "@/types/settings";
import { RowDataPacket } from 'mysql2/promise';
import type { Express } from 'express';

const TABLE_NAME = "settings"; 
const DEFAULT_SNS_IDS: SnsLink["id"][] = ["instagram", "youtube", "twitter", "cafe", "shop"];
const MAIN_IMAGE_S3_KEY = "images/main.png"; // 메인 이미지의 고정 S3 키

// DB에서 반환될 설정 로우 타입 정의
interface SettingsRow extends RowDataPacket {
    id: number; 
    data: string; 
}

// ----------------------------------------------------
// DB 조회 (GET)
// ----------------------------------------------------
/**
 * 설정 조회
 */
export const getSettings = async (): Promise<SettingsData> => {
    const [rows] = await pool.execute<SettingsRow[]>(
        `SELECT data FROM ${TABLE_NAME} WHERE id = 1`
    );

    if (rows.length === 0 || !rows[0].data) {
        return {
            mainImage: "",
            snsLinks: DEFAULT_SNS_IDS.map(id => ({ id, url: "" })),
        };
    }

    const stored: SettingsData = JSON.parse(rows[0].data as string);

    return {
        mainImage: stored.mainImage || "",
        snsLinks: DEFAULT_SNS_IDS.map(
            id => stored.snsLinks?.find(link => link.id === id) || { id, url: "" }
        ),
    };
};

// ----------------------------------------------------
// DB 저장 (UPSERT)
// ----------------------------------------------------
/**
 * 설정 저장
 */
export const saveSettings = async (
    snsLinks: SnsLink[],
    file?: Express.Multer.File
): Promise<SettingsData> => {
    
    const currentSettings = await getSettings();
    let mainImage = currentSettings.mainImage || ""; 

    if (file) {
        // 새 파일이 업로드된 경우: 기존 S3 파일 삭제 후 새 파일 업로드
        try {
            await deleteFromStorage(MAIN_IMAGE_S3_KEY);
            console.log(`[S3 DELETE] Deleted old main image: ${MAIN_IMAGE_S3_KEY}`);
        } catch (e) {
            console.warn(`Error deleting old main image (key: ${MAIN_IMAGE_S3_KEY}):`, e);
        }

        mainImage = await uploadBufferToStorage(file.buffer, MAIN_IMAGE_S3_KEY, file.mimetype);
    } 
    // 파일이 없으면 기존 mainImage 값 유지 (1단계에서 설정됨)

    const finalSnsLinks: SnsLink[] = DEFAULT_SNS_IDS.map(
        id => snsLinks.find(l => l.id === id) || { id, url: "" }
    );

    const settingsData: SettingsData = { snsLinks: finalSnsLinks, mainImage };
    const settingsJsonString = JSON.stringify(settingsData);
    
    // DB 업데이트
    await pool.execute(
        `INSERT INTO ${TABLE_NAME} (id, data) 
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [settingsJsonString]
    );

    return settingsData;
};

// ----------------------------------------------------
// ⭐️ 메인 이미지 삭제 (TS2339 오류 해결)
// ----------------------------------------------------
/**
 * 메인 이미지 삭제
 */
export const deleteMainImage = async (): Promise<boolean> => {
    
    // 1. 기존 설정 조회
    const currentSettings = await getSettings();
    const currentImageUrl = currentSettings.mainImage;

    if (!currentSettings || !currentImageUrl) {
        return false; // 삭제할 이미지가 없음
    }

    // 2. S3에서 이미지 삭제
    try {
        await deleteFromStorage(MAIN_IMAGE_S3_KEY);
        console.log(`[S3 DELETE] Deleted main image key: ${MAIN_IMAGE_S3_KEY}`);
    } catch (e) {
        console.warn(`Error deleting main image from S3 (key: ${MAIN_IMAGE_S3_KEY}):`, e);
    }

    // 3. DB 업데이트: mainImage 필드를 빈 문자열("")로 설정하고 전체 JSON 업데이트
    const settingsData = { ...currentSettings, mainImage: "" };
    const settingsJsonString = JSON.stringify(settingsData);
    
    await pool.execute(
        `INSERT INTO ${TABLE_NAME} (id, data) 
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [settingsJsonString]
    );

    return true; 
};