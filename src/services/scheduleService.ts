// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "../config/db-config"; 
import type { ScheduleEvent } from '@/types/schedule';
import { v4 as uuidv4 } from 'uuid'; // 기존 UUID 생성 함수 유지
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "schedules"; // MariaDB 테이블 이름

// DB에서 반환될 스케줄 로우 타입 정의 (id는 문자열 UUID라고 가정)
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
    // 1. UUID 생성 (기존 Firestore 방식 유지)
    const id = uuidv4();
    
    // 2. 쿼리를 위한 키와 값 배열 생성
    // 테이블의 모든 컬럼 이름과 일치한다고 가정합니다.
    const keys = ['id', ...Object.keys(data)].join(', ');
    const placeholders = Object.keys(data).fill('?').map(() => '?').join(', '); 
    const values = [id, ...Object.values(data)];

    // 3. 데이터 삽입 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (${keys}) VALUES (?, ${placeholders})`,
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
    
    // DB 로우를 ScheduleEvent 타입에 맞게 반환 (id는 이미 문자열 UUID이므로 변환 불필요)
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
): Promise<void> => {
    // SET 구문 생성을 위한 키-값 배열 준비
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // UPDATE 쿼리 실행
    await pool.execute(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id] // 값 배열 뒤에 WHERE 조건인 id 추가
    );
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (id: string): Promise<void> => {
    // DELETE 쿼리 실행
    await pool.execute(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
};