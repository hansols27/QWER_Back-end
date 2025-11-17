// ⭐️ uuidv4 임포트 추가
import { v4 as uuidv4 } from "uuid";
import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@config/db-config"; // MariaDB 연결 풀
import type { Notice } from "@/types/notice"; 

const TABLE_NAME = "notice"; // MariaDB 테이블 이름

interface NoticeRow extends Omit<Notice, 'createdAt' | 'updatedAt'>, RowDataPacket {
    createdAt: Date; 
    updatedAt: Date; 
}

// 헬퍼 함수: DB Row를 Notice 타입으로 변환
// 💡 Notice 타입이 id, createdAt, updatedAt 필드를 모두 포함한다고 가정하고 함수를 단순화
const mapRowToNotice = (row: NoticeRow): Notice => ({
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
export async function getNotices(): Promise<Notice[]> {
    const [rows] = await pool.execute<NoticeRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY createdAt DESC`
    );
    
    return rows.map(mapRowToNotice);
}

/**
 * 단일 공지사항 상세 조회
 */
export async function getNotice(id: string): Promise<Notice | null> {
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
    // 💡 data 타입 정리: Notice에서 ID, Time 필드를 제외한 타입을 사용
    data: Omit<Notice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Notice> {
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
        throw new Error("공지사항 생성 후 조회 실패");
    }

    return newNotice;
}

/**
 * 공지사항 수정
 */
export async function updateNotice(
    id: string,
    // 💡 data 타입 정리: Notice에서 ID, Time 필드를 제외한 타입의 Partial
    data: Partial<Omit<Notice, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<number> {
    
    const dataEntries = Object.entries(data);

    if (dataEntries.length === 0) return 0; // 업데이트할 내용이 없으면 0 반환

    // 💡 개선: 키 접근 시 타입 안전성 확보
    const setClauses = dataEntries
        .map(([key]) => `${key} = ?`)
        .join(', ');
    
    const values = dataEntries.map(([, value]) => value);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        // updatedAt = NOW()를 SET 절에 추가
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