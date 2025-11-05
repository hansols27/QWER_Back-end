// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "../config/db-config"; 
import type { VideoItem } from "@/types/video";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "videos"; 

// DB에서 반환되는 로우(Row) 타입 정의 (id는 DB에서 숫자형이라고 가정)
interface VideoRow extends Omit<VideoItem, 'id'>, RowDataPacket {
    id: number;
}

// ----------------------------------------------------
// DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 전체 영상 조회 (createdAt 기준 내림차순)
 */
export async function getVideos(): Promise<VideoItem[]> {
    const [rows] = await pool.execute<VideoRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );
    
    return rows.map(row => ({ 
        ...row, 
        id: String(row.id) 
    })) as VideoItem[];
}

/**
 * 단일 영상 조회
 */
export async function getVideoById(id: string): Promise<VideoItem | null> {
    const [rows] = await pool.execute<VideoRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) return null;
    
    const row = rows[0];
    return { 
        ...row, 
        id: String(row.id) 
    } as VideoItem;
}

/**
 * 영상 등록
 */
export async function createVideo(data: Omit<VideoItem, "id">): Promise<VideoItem> {
    const keys = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).fill('?').join(', ');
    const values = Object.values(data);
    
    // 1. 데이터 삽입 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (${keys}) VALUES (${placeholders})`,
        values
    );

    const newId = result.insertId;

    // 2. 삽입된 전체 데이터를 다시 조회하여 반환 형식에 맞춤 (ID 포함)
    const [rows] = await pool.execute<VideoRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [newId]
    );

    const newVideo = rows[0];
    return { 
        ...newVideo, 
        id: String(newVideo.id) 
    } as VideoItem;
}

/**
 * 영상 수정
 */
export async function updateVideo(id: string, data: Partial<Omit<VideoItem, "id">>): Promise<number> {
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id]
    );

    // ⭐️ affectedRows 반환 (컨트롤러에서 404 처리를 돕기 위함)
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

    // ⭐️ affectedRows 반환 (컨트롤러에서 404 처리를 돕기 위함)
    return result.affectedRows;
}