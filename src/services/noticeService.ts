// ⭐️ uuidv4 임포트 추가
import { v4 as uuidv4 } from "uuid";
import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config"; // MariaDB 연결 풀
import type { Notice } from "@/types/notice"; // Notice 타입은 id, type, title, content, createdAt, updatedAt 필드를 가질 것으로 가정
import { getAlbumById } from "./albumService"; // albumService의 getAlbumById를 삭제했습니다.

const TABLE_NAME = "notice"; // MariaDB 테이블 이름

// DB에서 반환될 로우 타입 정의
// Notice 타입의 id, createdAt, updatedAt 필드는 DB에서 다르게 처리되거나 매핑되므로 Omit 대상에 포함합니다.
interface NoticeRow extends Omit<Notice, 'id' | 'createdAt' | 'updatedAt'>, RowDataPacket {
    id: string; // DB의 VARCHAR(36)
    createdAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
    updatedAt: Date; // DB에서 DATETIME을 조회할 때 반환되는 Date 객체
}

// 헬퍼 함수: DB Row를 Notice 타입으로 변환
const mapRowToNotice = (row: NoticeRow): Notice & { id: string } => ({
    ...row,
    id: row.id,
    // DB의 Date 객체를 Notice 타입의 예상 타입인 string으로 변환
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
});

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
    
    return rows.map(mapRowToNotice);
}

/**
 * 단일 공지사항 상세 조회
 */
export async function getNotice(id: string): Promise<(Notice & { id: string }) | null> {
    const [rows] = await pool.execute<NoticeRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) {
        return null;
    }

    return mapRowToNotice(rows[0]);
}

/**
 * 공지사항 등록
 */
export async function createNotice(
    data: { type: string; title: string; content: string }
): Promise<(Notice & { id: string })> {
    const { type, title, content } = data;
    
    // 1. UUID 생성 (VARCHAR 기본 키 사용)
    const id = uuidv4();
    
    await pool.execute<ResultSetHeader>(
        // id를 직접 삽입하고, createdAt, updatedAt에 NOW() 사용
        `INSERT INTO ${TABLE_NAME} (id, type, title, content, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`, 
        [id, type, title, content]
    );

    // 2. 삽입된 레코드 조회 및 반환
    const newNotice = await getNotice(id);

    if (!newNotice) {
        // 이론적으로 발생하지 않아야 함
        throw new Error("공지사항 생성 후 조회 실패");
    }

    return newNotice;
}

/**
 * 공지사항 수정
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
    
    return result.affectedRows;
}

/**
 * 공지사항 삭제
 */
export async function deleteNotice(id: string): Promise<number> {
    // DELETE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    return result.affectedRows;
}