// ⭐️ MariaDB 연결 풀 임포트 (경로 확인)
import pool from "../config/db-config"; 
import type { Notice } from "@/types/notice";
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "notices"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의 (id는 숫자형, Date 필드는 문자열로 가정)
interface NoticeRow extends Notice, RowDataPacket {
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
    
    // DB의 숫자 ID를 문자열로 변환하여 반환 타입에 맞춤
    return rows.map(row => ({ 
        ...row, 
        id: String(row.id) 
    }));
}

/**
 * 단일 공지사항 상세 조회
 */
export async function getNotice(id: string): Promise<Notice & { id: string }> {
    // ID를 기준으로 단일 로우 조회
    const [rows] = await pool.execute<NoticeRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) {
        throw new Error("Notice not found");
    }

    const row = rows[0];
    return { 
        ...row, 
        id: String(row.id) // 숫자 ID를 문자열로 변환
    };
}

/**
 * 공지사항 등록
 */
export async function createNotice(
    data: { type: string; title: string; content: string }
): Promise<{ id: string }> {
    // MariaDB의 TIMESTAMP 컬럼은 DEFAULT CURRENT_TIMESTAMP로 자동 처리되도록 가정
    const { type, title, content } = data;
    
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (type, title, content, createdAt, updatedAt) 
         VALUES (?, ?, ?, NOW(), NOW())`, // NOW() 함수로 DB에서 현재 시각 자동 입력
        [type, title, content]
    );

    // 삽입된 데이터의 Primary Key (ID) 반환
    return { id: String(result.insertId) };
}

/**
 * 공지사항 수정
 */
export async function updateNotice(
    id: string,
    data: Partial<{ type: string; title: string; content: string }>
): Promise<void> {
    // SET 구문 생성을 위한 키-값 배열 준비
    const updates = Object.keys(data);
    const setClauses = updates.map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // UPDATE 쿼리 실행 (updatedAt을 NOW()로 자동 업데이트)
    await pool.execute(
        `UPDATE ${TABLE_NAME} SET ${setClauses}, updatedAt = NOW() WHERE id = ?`, 
        [...values, id]
    );
}

/**
 * 공지사항 삭제
 */
export async function deleteNotice(id: string): Promise<void> {
    // DELETE 쿼리 실행
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
}