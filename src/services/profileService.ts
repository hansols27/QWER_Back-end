// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "../config/db-config";
// ⭐️ AWS S3 버퍼 업로드 함수 임포트 (경로 확인)
import { uploadBufferToStorage } from '../utils/aws-s3-upload'; 

// ⭐️ MemberContentPayloadItem 추가 임포트
import { MemberPayload, MemberState, MemberContentPayloadItem, MemberSNS } from '@/types/member';
import type { Express } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "profiles"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의
interface ProfileRow extends RowDataPacket {
    id: string; // 멤버 ID (Primary Key)
    name: string; // 멤버 이름 (별도 컬럼)
    data: string; // MemberPayload가 JSON 문자열로 저장될 컬럼
}

/**
 * Admin에서 받은 상태(MemberState)를 MemberPayload로 변환 후 저장
 * 기존의 Firestore 저장 및 Firebase Storage 업로드 로직을 대체합니다.
 */
export const saveProfile = async (
    id: string,
    name: string,
    data: MemberState,
    files?: Express.Multer.File[]
): Promise<{ contentsUrls: string[] }> => {
    const imageUrls: string[] = [];

    // 🔹 1. 이미지 업로드 (Firebase Storage -> AWS S3)
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const idx = String(i + 1).padStart(2, '0'); // 01, 02, ...
            
            // S3 경로: members/id01.png, members/id02.png
            const destPath = `members/${id}${idx}.png`; 
            
            // AWS S3 버퍼 업로드 함수 사용
            const url = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
            imageUrls.push(url);
        }
    }

    // 🔹 2. MemberPayload로 변환
    const payload: MemberPayload = {
        id,
        name,
        // 누락 필드 추가
        tracks: data.tracks, 
        type: data.type, 
        contents: [
            ...data.text.map(t => ({ type: 'text' as const, content: t })),
            // 기존 이미지 URL을 사용하거나, 새로 업로드된 이미지 URL을 사용
            ...data.image.map((img, i) => ({
                type: 'image' as const,
                content: typeof img === 'string' ? img : imageUrls[i] ?? ''
            }))
        ] as MemberContentPayloadItem[], // ⭐️ MemberContentPayloadItem[]으로 타입 단언 수정
        sns: data.sns ?? {}
    };
    
    // 🔹 3. MariaDB 저장 (JSON 타입 컬럼에 저장)
    const payloadJsonString = JSON.stringify(payload);

    // INSERT...ON DUPLICATE KEY UPDATE를 사용하여, ID가 이미 존재하면 업데이트합니다.
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (id, name, type, data) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), data = VALUES(data)`,
        [id, name, data.type, payloadJsonString]
    );

    return { contentsUrls: imageUrls };
};

/**
 * MariaDB에서 프로필 조회
 * 기존의 Firestore 조회 로직을 대체합니다.
 */
export const getProfileById = async (id: string): Promise<MemberPayload | null> => {
    // ID를 기준으로 단일 로우 조회
    const [rows] = await pool.execute<ProfileRow[]>(
        `SELECT data FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );

    if (rows.length === 0 || !rows[0].data) return null;

    // JSON 문자열을 객체로 파싱하여 반환
    return JSON.parse(rows[0].data as string) as MemberPayload;
};
