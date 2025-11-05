// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "@config/db-config"; 
import type { ScheduleEvent } from '@/types/schedule';
import { v4 as uuidv4 } from 'uuid'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "schedules"; // MariaDB 테이블 이름

// DB에서 반환될 스케줄 로우 타입 정의
interface ScheduleRow extends Omit<ScheduleEvent, 'id'>, RowDataPacket {
    id: string; // 문자열 UUID
}

// ----------------------------------------------------
// DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 스케줄 생성
 */
export const createSchedule = async (
    data: Omit<ScheduleEvent, 'id'>
): Promise<{ id: string }> => {
    // 1. UUID 생성
    const id = uuidv4();
    
    // ⭐️ 2. 쿼리 구성 간결화: keys, placeholders, values 배열 생성
    const keys = ['id', ...Object.keys(data)];
    const placeholders = keys.map(() => '?').join(', ');
    const values = [id, ...Object.values(data)];

    // 3. 데이터 삽입 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (${keys.join(', ')}) VALUES (${placeholders})`,
        values
    );

    return { id };
};

/**
 * 모든 스케줄 조회 (startTime 기준 오름차순)
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
    // SQL 쿼리 실행
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY startTime ASC`
    );
    
    // DB 로우를 ScheduleEvent 타입에 맞게 반환
    return rows as ScheduleEvent[];
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
    // WHERE 조건에 id 사용
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) return null;
    
    return rows[0] as ScheduleEvent;
};

/**
 * 스케줄 수정
 */
export const updateSchedule = async (
    id: string,
    data: Partial<Omit<ScheduleEvent, 'id'>>
): Promise<number> => { // ⭐️ affectedRows 반환을 위해 number로 변경
    // SET 구문 생성을 위한 키-값 배열 준비
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id] // 값 배열 뒤에 WHERE 조건인 id 추가
    );
    
    // ⭐️ 컨트롤러에서 404 처리를 돕기 위해 affectedRows 반환
    return result.affectedRows;
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (id: string): Promise<number> => { // ⭐️ affectedRows 반환을 위해 number로 변경
    // DELETE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    // ⭐️ 컨트롤러에서 404 처리를 돕기 위해 affectedRows 반환
    return result.affectedRows;
};