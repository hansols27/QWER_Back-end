// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "@config/db-config"; 
import type { Notice } from "@/types/notice";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "notice"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의
interface NoticeRow extends Omit<Notice, 'id'>, RowDataPacket {
    id: string; // DB의 Primary Key
    createdAt: string;
    updatedAt: string;
}

// ----------------------------------------------------
// DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 전체 공지사항 조회 (createdAt 기준 내림차순)
 */
export async function getNotices(): Promise<(Notice & { id: string })[]> {
    const [rows] = await pool.execute<NoticeRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );
    
    return rows.map(row => ({ 
        ...row, 
        id: String(row.id) 
    }));
}

/**
 * 단일 공지사항 상세 조회
 * ⭐️ 개선: 찾지 못하면 throw 대신 null 반환
 */
export async function getNotice(id: string): Promise<(Notice & { id: string }) | null> {
    const [rows] = await pool.execute<NoticeRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    // ⭐️ rows.length === 0 이면 null 반환
    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    return { 
        ...row, 
        id: String(row.id)
    };
}

/**
 * 공지사항 등록
 */
export async function createNotice(
    data: { type: string; title: string; content: string }
): Promise<{ id: string }> {
    const { type, title, content } = data;
    
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (type, title, content, createdAt, updatedAt) 
         VALUES (?, ?, ?, NOW(), NOW())`, 
        [type, title, content]
    );

    return { id: String(result.insertId) };
}

/**
 * 공지사항 수정
 * ⭐️ 개선: affectedRows 반환
 */
export async function updateNotice(
    id: string,
    data: Partial<{ type: string; title: string; content: string }>
): Promise<number> {
    const updates = Object.keys(data);
    const setClauses = updates.map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses}, updatedAt = NOW() WHERE id = ?`, 
        [...values, id]
    );
    
    // ⭐️ affectedRows 반환
    return result.affectedRows;
}

/**
 * 공지사항 삭제
 * ⭐️ 개선: affectedRows 반환
 */
export async function deleteNotice(id: string): Promise<number> {
    // DELETE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    // ⭐️ affectedRows 반환
    return result.affectedRows;
}