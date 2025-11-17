// ⭐️ UUIDv4 임포트 추가
import { v4 as uuidv4 } from "uuid";
// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "../config/db-config"; 
// VideoItem 타입 정의: { id: string, title: string, src: string, createdAt: string }
import type { VideoItem } from "@/types/video"; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "video"; // 테이블 이름

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB에서 반환되는 로우(Row) 타입 정의: 
interface VideoRow extends Omit<VideoItem, 'id' | 'createdAt'>, RowDataPacket {
    id: string;
    createdAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
}

// 헬퍼 함수: DB Row를 VideoItem 타입으로 변환
const mapRowToVideoItem = (row: VideoRow): VideoItem => ({
    ...row,
    id: row.id,
    // DB의 Date 객체를 VideoItem의 예상 타입인 string(ISO)으로 변환
    createdAt: row.createdAt.toISOString(),
});


// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 전체 영상 조회 (createdAt 기준 내림차순)
 */
export async function getVideos(): Promise<VideoItem[]> {
    const [rows] = await pool.execute<VideoRow[]>(
        `SELECT id, title, src, createdAt FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );
    
    return rows.map(mapRowToVideoItem);
}

/**
 * 단일 영상 조회
 */
export async function getVideoById(id: string): Promise<VideoItem | null> {
    const [rows] = await pool.execute<VideoRow[]>(
        `SELECT id, title, src, createdAt FROM ${TABLE_NAME} WHERE id = ?`, 
        [id] // ID는 string (UUID)
    );

    if (rows.length === 0) return null;
    
    return mapRowToVideoItem(rows[0]);
}

/**
 * 영상 등록
 */
// data: 컨트롤러에서 { title, src }만 전달받음
export async function createVideo(data: Omit<VideoItem, "id" | "createdAt">): Promise<VideoItem> {
    // 1. UUID 생성
    const newId = uuidv4(); 
    
    // 2. 데이터 삽입 쿼리 실행
    // 💡 개선: 템플릿 리터럴로 쿼리를 명확하게 작성
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (id, title, src, createdAt) VALUES (?, ?, ?, NOW())`,
        [newId, data.title, data.src] 
    );

    // 3. 삽입된 전체 데이터를 다시 조회하여 반환 형식에 맞춤
    const newVideo = await getVideoById(newId);

    if (!newVideo) {
        // 이 오류는 DB 삽입은 성공했으나 바로 조회가 안 될 경우 발생
        throw new Error("영상 생성 후 조회에 실패했습니다.");
    }
    
    return newVideo;
}

/**
 * 영상 수정
 */
// data: Partial<{ title: string, src: string }>
export async function updateVideo(id: string, data: Partial<Omit<VideoItem, "id" | "createdAt">>): Promise<number> {
    const dataEntries = Object.entries(data);

    // 💡 개선: 수정할 데이터가 없을 경우 바로 0 반환
    if (dataEntries.length === 0) {
        return 0;
    }

    // 쿼리의 SET 절 구성: "key1 = ?, key2 = ?"
    const setClauses = dataEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = dataEntries.map(([, value]) => value);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id]
    );

    // affectedRows 반환
    return result.affectedRows;
}

/**
 * 영상 삭제
 */
export async function deleteVideo(id: string): Promise<number> {
    // DELETE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    // affectedRows 반환
    return result.affectedRows;
}