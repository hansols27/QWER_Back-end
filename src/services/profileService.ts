// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "@config/db-config";
// ⭐️ AWS S3 버퍼 업로드 및 삭제 함수 임포트
import { uploadBufferToStorage, deleteFromStorage } from '@utils/aws-s3-upload'; 

// ⭐️ 타입 임포트
import { MemberPayload, MemberState, MemberContentPayloadItem } from '@/types/member';
import type { Express } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "profiles"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의 (DB에 type 컬럼이 있다고 가정)
interface ProfileRow extends RowDataPacket {
    id: string; // 멤버 ID (Primary Key)
    name: string; // 멤버 이름
    type: string; // 멤버 타입 (예: 보컬, 드럼 등)
    data: string; // MemberPayload가 JSON 문자열로 저장될 컬럼
}

/**
 * 헬퍼: S3 URL에서 키(Key) 추출 (S3 삭제 시 사용)
 * @param url S3 파일의 전체 URL
 * @returns S3 Key 문자열 또는 null
 */
const extractS3Key = (url: string): string | null => {
    try {
        const urlParts = new URL(url);
        // 경로에서 첫 '/'를 제거한 나머지 문자열이 Key입니다.
        const path = urlParts.pathname.substring(1); 
        // 'members/' 경로로 시작하는지 확인 (선택 사항)
        return path.startsWith('members/') ? path : null;
    } catch (e) {
        return null;
    }
};

// ----------------------------------------------------
// DB 조회 (GET)
// ----------------------------------------------------

/**
 * MariaDB에서 프로필 조회
 * @param id 멤버 ID
 * @returns MemberPayload 객체 또는 null
 */
export const getProfileById = async (id: string): Promise<MemberPayload | null> => {
    // ID를 기준으로 단일 로우 조회
    const [rows] = await pool.execute<ProfileRow[]>(
        `SELECT data FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );

    if (rows.length === 0 || rows[0].data === null) return null;

    // JSON 문자열을 객체로 파싱하여 반환
    return JSON.parse(rows[0].data) as MemberPayload;
};

// ----------------------------------------------------
// DB/S3 저장 및 업데이트 (UPSERT)
// ----------------------------------------------------

/**
 * Admin에서 받은 상태(MemberState)를 MemberPayload로 변환 후 저장 (Upsert)
 * @param id 멤버 ID
 * @param name 멤버 이름
 * @param data Admin으로부터 받은 MemberState 데이터
 * @param files Multer로 받은 커버 이미지 파일 목록
 * @returns 새로 업로드된 이미지 URL 목록
 */
export const saveProfile = async (
    id: string,
    name: string,
    data: MemberState,
    files?: Express.Multer.File[]
): Promise<{ contentsUrls: string[] }> => {

    // 🔹 1. 기존 데이터 조회 및 기존 이미지 URL 추출
    const existingProfile = await getProfileById(id);
    const existingImageUrls = existingProfile 
        ? existingProfile.contents.filter(item => item.type === 'image').map(item => item.content)
        : [];
        
    const imageUrls: string[] = [];
    const newFileKeys: string[] = [];

    // 🔹 2. 새 이미지 업로드 및 URL/Key 생성
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const idx = String(i + 1).padStart(2, '0');
            
            // S3 경로: members/id01.png
            const destPath = `members/${id}${idx}.png`; 
            
            const url = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
            imageUrls.push(url);
            newFileKeys.push(destPath);
        }
    }

    // 🔹 3. 기존 이미지 삭제 (S3 파일 누적 방지)
    for (const oldUrl of existingImageUrls) {
        try {
            const oldKey = extractS3Key(oldUrl);
            
            // 기존 Key가 유효하고, 새로 업로드된 Key 목록에 포함되어 있지 않다면 삭제합니다.
            if (oldKey && !newFileKeys.includes(oldKey)) {
                await deleteFromStorage(oldKey);
                console.log(`[S3 DELETE] Deleted old profile image: ${oldKey}`);
            }
        } catch (e) {
            console.error(`Error extracting/deleting old S3 key: ${oldUrl}`, e);
        }
    }
    
    // 🔹 4. MemberPayload로 변환
    const payload: MemberPayload = {
        id,
        name,
        tracks: data.tracks, 
        type: data.type, 
        contents: [
            // 텍스트 콘텐츠 매핑
            ...data.text.map(t => ({ type: 'text' as const, content: t })),
            // 이미지 콘텐츠 매핑: 기존 URL을 사용하거나 새로 업로드된 URL을 사용
            ...data.image.map((img, i) => ({
                type: 'image' as const,
                content: typeof img === 'string' ? img : imageUrls[i] ?? ''
            }))
        ] as MemberContentPayloadItem[], 
        // ⭐️ MemberSNS 정보 포함
        sns: data.sns ?? {} 
    };
    
    // 🔹 5. MariaDB 저장 (Upsert)
    const payloadJsonString = JSON.stringify(payload);

    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (id, name, type, data) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), data = VALUES(data)`,
        [id, name, data.type, payloadJsonString]
    );

    return { contentsUrls: imageUrls };
};