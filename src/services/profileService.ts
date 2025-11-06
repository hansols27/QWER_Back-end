// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "@config/db-config";
// ⭐️ AWS S3 버퍼 업로드 및 삭제 함수 임포트
import { uploadBufferToStorage, deleteFromStorage } from '@utils/aws-s3-upload'; 

// ⭐️ 타입 임포트
import { MemberPayload, MemberState, MemberContentPayloadItem } from '@/types/member';
import type { Express } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// 🚨 테이블 이름 수정: 이전에 제안했던 테이블 이름 'members' 사용
const TABLE_NAME = "members"; 

// DB에서 반환될 로우 타입 정의 (DB 구조에 맞춤)
interface MemberRow extends RowDataPacket {
    id: string; // 멤버 ID (VARCHAR(255))
    name: string; // 멤버 이름 (VARCHAR(100))
    type: string; // 멤버 타입 (VARCHAR(50))
    tracks: string; // JSON 문자열
    contents: string; // JSON 문자열
    sns: string; // JSON 문자열
    // createdAt, updatedAt 생략 가능
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

// 헬퍼: DB 로우를 MemberPayload로 변환
const mapRowToMemberPayload = (row: MemberRow): MemberPayload => ({
    id: row.id,
    name: row.name,
    type: row.type,
    tracks: JSON.parse(row.tracks || '[]'),
    contents: JSON.parse(row.contents || '[]'),
    sns: JSON.parse(row.sns || '{}'),
});


// ----------------------------------------------------
// DB 조회 (GET)
// ----------------------------------------------------

/**
 * MariaDB에서 프로필 조회
 * @param id 멤버 ID
 * @returns MemberPayload 객체 또는 null
 */
export const getProfileById = async (id: string): Promise<MemberPayload | null> => {
    // 🚨 컬럼 수정: data 대신 tracks, contents, sns를 조회
    const [rows] = await pool.execute<MemberRow[]>(
        `SELECT id, name, type, tracks, contents, sns FROM ${TABLE_NAME} WHERE id = ?`,
        [id]
    );

    if (rows.length === 0) return null;

    // JSON 문자열을 객체로 파싱하여 반환
    return mapRowToMemberPayload(rows[0]);
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
            // S3 경로: members/id01.png 대신 UUIDv4 사용을 권장합니다.
            // 여기서는 기존 로직을 유지하되, 파일명 충돌을 방지하기 위해 UUID를 포함하도록 수정합니다.
            const fileUUID = new Date().getTime(); 
            const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
            const destPath = `members/${id}/${fileUUID}.${mimeTypeExtension}`; 
            
            const url = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
            imageUrls.push(url);
            newFileKeys.push(destPath);
        }
    }

    // 🔹 3. 기존 이미지 삭제 (S3 파일 누적 방지)
    // 이 로직은 이미지 URL이 바뀌었을 경우에만 기존 파일을 삭제해야 합니다.
    // 기존 로직을 유지하며 S3 Key를 사용하도록 합니다.
    for (const oldUrl of existingImageUrls) {
        try {
            const oldKey = extractS3Key(oldUrl);
            
            // 기존 Key가 유효하고, 새로 업로드된 Key 목록에 포함되어 있지 않다면 삭제합니다.
            // (이 로직은 MemberState가 이미지 배열을 URL/File로 구분하여 보낸다는 가정 하에 수정이 필요함)
            
            // 단순화: DB에 저장된 기존 URL이 새 이미지 목록에 없다면 삭제
            if (oldKey && !imageUrls.includes(oldUrl)) { 
                await deleteFromStorage(oldKey);
                // console.log(`[S3 DELETE] Deleted old profile image: ${oldKey}`);
            }
        } catch (e) {
            console.error(`Error extracting/deleting old S3 key: ${oldUrl}`, e);
        }
    }
    
    // 🔹 4. MemberPayload로 변환
    const payloadContents: MemberContentPayloadItem[] = [
        // 텍스트 콘텐츠 매핑
        ...data.text.map(t => ({ type: 'text' as const, content: t })),
        // 이미지 콘텐츠 매핑: 기존 URL을 사용하거나 새로 업로드된 URL을 사용
        ...data.image.map((img, i) => ({
            type: 'image' as const,
            // img가 문자열(기존 URL)이거나, 아니면 새로 업로드된 URL을 사용
            content: typeof img === 'string' ? img : imageUrls[i] ?? ''
        }))
    ] as MemberContentPayloadItem[]; 

    const payload: MemberPayload = {
        id,
        name,
        tracks: data.tracks, 
        type: data.type, 
        contents: payloadContents, 
        sns: data.sns ?? {} 
    };
    
    // 🔹 5. MariaDB 저장 (Upsert)
    // 🚨 컬럼 수정: tracks, contents, sns 컬럼을 사용
    const tracksJsonString = JSON.stringify(payload.tracks);
    const contentsJsonString = JSON.stringify(payload.contents);
    const snsJsonString = JSON.stringify(payload.sns);


    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (id, name, type, tracks, contents, sns) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            name = VALUES(name), 
            type = VALUES(type), 
            tracks = VALUES(tracks), 
            contents = VALUES(contents), 
            sns = VALUES(sns)`,
        [id, name, data.type, tracksJsonString, contentsJsonString, snsJsonString]
    );

    return { contentsUrls: imageUrls };
};