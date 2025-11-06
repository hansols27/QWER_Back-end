// ⭐️ DB 연결 풀 임포트
import pool from "@config/db-config"; 
// ⭐️ AWS S3 버퍼 업로드 및 삭제 함수 임포트
import { uploadBufferToStorage, deleteFromStorage } from "@utils/aws-s3-upload"; 
import type { SettingsData, SnsLink } from "@/types/settings";
import { RowDataPacket } from 'mysql2/promise';
import type { Express } from 'express';

const TABLE_NAME = "settings"; 
// DB id는 단일 설정을 위해 '1'만 사용한다고 가정합니다.
const DEFAULT_SNS_IDS: SnsLink["id"][] = ["instagram", "youtube", "twitter", "cafe", "shop"];
// S3 키를 URL 대신 Key로 전달한다고 가정하여 S3 유틸리티 함수와 호환성을 유지합니다.
const MAIN_IMAGE_S3_KEY = "images/main.png"; // 메인 이미지의 고정 S3 키

// DB에서 반환될 설정 로우 타입 정의
interface SettingsRow extends RowDataPacket {
    id: number; // DB의 Primary Key (대부분 1)
    data: string; // JSON 문자열로 저장된 SettingsData
}

// ----------------------------------------------------
// DB 조회 (GET)
// ----------------------------------------------------
/**
 * 설정 조회
 */
export const getSettings = async (): Promise<SettingsData> => {
    // 단일 레코드 (ID=1)의 data 컬럼 조회
    const [rows] = await pool.execute<SettingsRow[]>(
        `SELECT data FROM ${TABLE_NAME} WHERE id = 1`
    );

    if (rows.length === 0 || !rows[0].data) {
        // 기본값 반환
        return {
            mainImage: "",
            snsLinks: DEFAULT_SNS_IDS.map(id => ({ id, url: "" })),
        };
    }

    // JSON 문자열 파싱
    const stored: SettingsData = JSON.parse(rows[0].data as string);

    // 기본 SNS 링크를 기준으로 데이터 정렬 및 누락된 항목 채우기
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
            // S3 URL이 아닌 Key를 사용하여 삭제한다고 가정
            await deleteFromStorage(MAIN_IMAGE_S3_KEY);
            console.log(`[S3 DELETE] Deleted old main image: ${MAIN_IMAGE_S3_KEY}`);
        } catch (e) {
            console.warn(`Error deleting old main image (key: ${MAIN_IMAGE_S3_KEY}):`, e);
        }

        // 새 파일 업로드: URL을 반환받아 mainImage에 저장
        mainImage = await uploadBufferToStorage(file.buffer, MAIN_IMAGE_S3_KEY, file.mimetype);
    } 

    // 최종 SNS 링크 목록 확정 (순서 정렬 및 빈 항목 채우기)
    const finalSnsLinks: SnsLink[] = DEFAULT_SNS_IDS.map(
        id => snsLinks.find(l => l.id === id) || { id, url: "" }
    );

    const settingsData: SettingsData = { snsLinks: finalSnsLinks, mainImage };
    const settingsJsonString = JSON.stringify(settingsData);
    
    // DB 업데이트/삽입 (UPSERT): id=1 레코드 사용
    await pool.execute(
        `INSERT INTO ${TABLE_NAME} (id, data) 
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [settingsJsonString]
    );

    return settingsData;
};

// ----------------------------------------------------
// 메인 이미지 삭제
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

    // 2. S3에서 이미지 삭제 (고정 키 사용)
    try {
        await deleteFromStorage(MAIN_IMAGE_S3_KEY);
        console.log(`[S3 DELETE] Deleted main image key: ${MAIN_IMAGE_S3_KEY}`);
    } catch (e) {
        console.warn(`Error deleting main image from S3 (key: ${MAIN_IMAGE_S3_KEY}):`, e);
        // S3 삭제 실패하더라도 DB 업데이트는 진행하여 URL을 지웁니다.
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