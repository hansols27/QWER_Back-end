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
// DB는 DATETIME을 Date 객체로, ID는 string(UUID)로 반환
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
// 🚨 수정: createdAt 필드를 Omit 대상에 추가하여, 컨트롤러가 { title, src }만 전달하도록 유도합니다.
// 이 수정으로 videoController.ts에서 발생했던 타입 오류(TS2345)가 해결됩니다.
export async function createVideo(data: Omit<VideoItem, "id" | "createdAt">): Promise<VideoItem> {
    // 1. UUID 생성 (VARCHAR 기본 키 사용)
    const newId = uuidv4(); 
    
    // 2. 쿼리 구성 및 NOW() 사용
    // DB 스키마: id, title, src, createdAt
    const keys = ["id", "title", "src", "createdAt"].join(', ');
    const placeholders = "?, ?, ?, NOW()";
    const values = [newId, data.title, data.src]; // data는 이제 title, src만 포함

    // 3. 데이터 삽입 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (${keys}) VALUES (${placeholders})`,
        values
    );

    // 4. 삽입된 전체 데이터를 다시 조회하여 반환 형식에 맞춤 (ID 포함, createdAt 포함)
    const newVideo = await getVideoById(newId);

    if (!newVideo) {
        throw new Error("영상 생성 후 조회에 실패했습니다.");
    }
    
    return newVideo;
}

/**
 * 영상 수정
 */
export async function updateVideo(id: string, data: Partial<Omit<VideoItem, "id" | "createdAt">>): Promise<number> {
    // 🚨 수정: 수정 시에도 createdAt을 직접 수정하는 것은 막는 것이 일반적이므로 Omit 대상에 추가
    
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    if (setClauses.length === 0) return 0;

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