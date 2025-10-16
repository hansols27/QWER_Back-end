// ⭐️ DB 연결 풀 임포트
import pool from "../config/db-config"; 
// ⭐️ AWS S3 버퍼 업로드 함수 임포트 (이전에 수정한 파일)
import { uploadBufferToStorage } from "../utils/aws-s3-upload"; 
import type { SettingsData, SnsLink } from "@/types/settings";
import { RowDataPacket } from 'mysql2/promise';

const TABLE_NAME = "settings"; // MariaDB 테이블 이름 (단일 로우 가정)
const DEFAULT_SNS_IDS: SnsLink["id"][] = ["instagram", "youtube", "twitter", "cafe", "shop"];

// DB에서 반환될 설정 로우 타입 정의 (JSON 컬럼을 저장할 컬럼 이름 'data'라고 가정)
interface SettingsRow extends RowDataPacket {
    id: number; // Primary Key
    data: string; // JSON 문자열이 저장될 컬럼
}
// 또는 JSON 컬럼이 MariaDB에서 객체로 자동 파싱된다면:
// interface SettingsRow extends SettingsData, RowDataPacket { id: number; }

/**
 * 설정 조회
 */
export const getSettings = async (): Promise<SettingsData> => {
    
    // MariaDB에서 단일 로우 조회
    const [rows] = await pool.execute<SettingsRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = 1` // 보통 단일 설정 로우는 ID 1 사용
    );

    if (rows.length === 0 || !rows[0].data) {
        // 데이터베이스에 설정 로우가 없거나 데이터가 비어있으면 기본값 반환
        return {
            mainImage: "",
            snsLinks: DEFAULT_SNS_IDS.map(id => ({ id, url: "" })),
        };
    }

    // JSON 문자열을 객체로 파싱
    const stored: SettingsData = JSON.parse(rows[0].data as string);

    // 저장된 데이터를 반환하되, SNS 링크는 기본 순서와 개수를 보장
    return {
        mainImage: stored.mainImage || "",
        snsLinks: DEFAULT_SNS_IDS.map(
            id => stored.snsLinks?.find(link => link.id === id) || { id, url: "" }
        ),
    };
};

/**
 * 설정 저장
 */
export const saveSettings = async (
    snsLinks: SnsLink[],
    file?: Express.Multer.File
): Promise<SettingsData> => {
    
    // 1. SNS 링크 기본값 보장
    const finalSnsLinks: SnsLink[] = DEFAULT_SNS_IDS.map(
        id => snsLinks.find(l => l.id === id) || { id, url: "" }
    );

    let mainImage = "";
    
    // 2. 이미지 처리
    if (file) {
        // AWS S3에 이미지 업로드 (파일 이름 고정: images/main.png)
        const destPath = "images/main.png";
        // ⭐️ 이전에 수정한 S3 버퍼 업로드 함수 사용
        mainImage = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
    } else {
        // 파일이 없으면 기존 이미지 URL을 DB에서 조회하여 유지
        const currentSettings = await getSettings();
        mainImage = currentSettings.mainImage || "";
    }

    // 3. 최종 데이터 객체 준비 및 JSON 직렬화
    const settingsData: SettingsData = { snsLinks: finalSnsLinks, mainImage };
    const settingsJsonString = JSON.stringify(settingsData);
    
    // 4. MariaDB에 저장 (ID=1 로우에 덮어쓰기 또는 삽입)
    // ON DUPLICATE KEY UPDATE를 사용하여, ID=1이 있으면 업데이트, 없으면 삽입합니다.
    await pool.execute(
        `INSERT INTO ${TABLE_NAME} (id, data) 
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [settingsJsonString]
    );

    return settingsData;
};