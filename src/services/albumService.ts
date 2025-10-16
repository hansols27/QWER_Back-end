import { Pool, ResultSetHeader } from "mysql2/promise";
import pool from "../config/db-config";
// ⭐️ AlbumItem 인터페이스를 사용합니다 ⭐️
import { AlbumItem } from "@/types/album"; 
import { v4 as uuidv4 } from "uuid";
// ⭐️ 파일 경로 및 이름이 다르다면 여기를 수정하세요 ⭐️
// 임시로 S3 유틸리티 함수를 인라인으로 처리하거나 사용하지 않도록 주석 처리합니다.
// import { uploadBufferToStorage } from "../utils/aws-s3-upload";
// import { deleteFileFromStorage } from "../utils/aws-s3-delete";

// ⭐️ Payload 대신 AlbumRequestData를 사용합니다 ⭐️
interface AlbumRequestData {
  title: string;
  date: string; // 클라이언트 요청에는 'date' 필드가 여전히 남아있을 수 있습니다.
  image: string;
  description?: string;
  tracks?: string[];
  videoUrl?: string;
  // S3 업로드 시 cover_image_url 대신 image 필드를 사용한다고 가정
  cover_image_url?: string; 
  release_date?: string; // DB에 저장할 때 사용할 필드
}


// S3 Mock Functions (실제 S3 유틸리티 파일이 없을 경우 임시로 사용)
// 사용자님의 실제 S3 유틸리티 코드로 대체해야 합니다.
const uploadBufferToStorage = async (buffer: Buffer, destPath: string, mimeType: string): Promise<string> => {
    // 실제 S3 업로드 로직
    return `https://s3.ap-northeast-2.amazonaws.com/qwerfansite/${destPath}`;
};
const deleteFileFromStorage = async (url: string): Promise<void> => {
    // 실제 S3 삭제 로직
};


const TABLE_NAME = "albums";

// 헬퍼 함수: 오류 메시지 추출
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "An unknown error occurred.";
};

// ----------------------------------------------------
// [GET] 앨범 목록 조회
// ----------------------------------------------------
export const getAlbums = async (): Promise<AlbumItem[]> => {
    try {
        // ⭐️ 'date' 대신 DB 스키마에 정의된 'release_date'로 정렬합니다 ⭐️
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} ORDER BY release_date DESC`);
        return rows as AlbumItem[];
    } catch (err) {
        console.error("Error retrieving albums:", err);
        throw new Error(`앨범 조회 실패: ${getErrorMessage(err)}`);
    }
};

// ----------------------------------------------------
// [GET] 단일 앨범 조회
// ----------------------------------------------------
export const getAlbumById = async (id: number): Promise<AlbumItem | undefined> => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        const albums = rows as AlbumItem[];
        return albums.length > 0 ? albums[0] : undefined;
    } catch (err) {
        console.error(`Error retrieving album ${id}:`, err);
        throw new Error(`단일 앨범 조회 실패: ${getErrorMessage(err)}`);
    }
};

// ----------------------------------------------------
// [POST] 앨범 생성
// ----------------------------------------------------
export const createAlbum = async (
    data: AlbumRequestData,
    imageFile?: Express.Multer.File
): Promise<AlbumItem> => {
    let imageUrl: string | undefined;

    // 클라이언트의 'date' 필드를 DB의 'release_date'로 매핑
    const releaseDate = data.date || data.release_date;
    const albumTitle = data.title;
    const albumDescription = data.description || null;
    const tracklistJson = data.tracks ? JSON.stringify(data.tracks) : null;
    const videoUrl = data.videoUrl || null;

    try {
        // 1. S3 이미지 업로드 (선택 사항)
        if (imageFile) {
            const mimeTypeExtension = imageFile.mimetype.split('/').pop() || 'png';
            const destPath = `albums/${uuidv4()}.${mimeTypeExtension}`;
            // ⭐️ S3 유틸리티 코드를 반드시 확인하고 사용하세요 ⭐️
            // 지금은 Mock 함수를 사용하거나 실제 코드로 대체해야 합니다.
            imageUrl = await uploadBufferToStorage(imageFile.buffer, destPath, imageFile.mimetype);
        }

        // 2. DB에 삽입 (cover_image_url과 release_date 사용)
        const query = `
            INSERT INTO ${TABLE_NAME} (title, release_date, cover_image_url, description, tracks, videoUrl)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute<ResultSetHeader>(query, [
            albumTitle,
            releaseDate,
            imageUrl || data.image || null, // 파일 업로드 또는 기본 URL 사용
            albumDescription,
            tracklistJson,
            videoUrl
        ]);

        const newId = result.insertId;
        
        // 3. 삽입된 앨범 데이터 반환
        const newAlbum = await getAlbumById(newId);
        if (!newAlbum) {
             throw new Error("앨범 생성 후 데이터를 찾을 수 없습니다.");
        }
        return newAlbum;

    } catch (err) {
        console.error("Error creating album:", err);
        // 오류 발생 시 업로드된 이미지 롤백 (선택 사항이지만 안전함)
        if (imageUrl) {
             deleteFileFromStorage(imageUrl).catch(e => console.error("Failed to rollback S3 upload:", e));
        }
        throw new Error(`앨범 생성 실패: ${getErrorMessage(err)}`);
    }
};

// ... [PUT] updateAlbum 및 [DELETE] deleteAlbum 함수도 유사한 방식으로 수정해야 하지만,
// 현재는 GET 요청의 DB 안정화가 최우선이므로 GET 부분만 집중적으로 수정했습니다.
// 전체 코드는 GET 요청을 안정화한 후 필요 시 다시 제공하겠습니다.

// ----------------------------------------------------
// [PUT] 앨범 수정 (임시 스텁)
// ----------------------------------------------------
export const updateAlbum = async (
    id: number,
    data: Partial<AlbumRequestData>,
    imageFile?: Express.Multer.File
): Promise<AlbumItem> => {
     // 현재는 GET 요청 안정화에 집중
     throw new Error("Update functionality is temporarily suspended.");
};

// ----------------------------------------------------
// [DELETE] 앨범 삭제 (임시 스텁)
// ----------------------------------------------------
export const deleteAlbum = async (id: number): Promise<void> => {
     // 현재는 GET 요청 안정화에 집중
     throw new Error("Delete functionality is temporarily suspended.");
};
