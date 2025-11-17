// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "@config/db-config"; 
import type { ScheduleEvent } from '@/types/schedule';
import { v4 as uuidv4 } from 'uuid'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "schedules"; // MariaDB 테이블 이름

// ----------------------------------------------------
// 1. 타입 정의 및 매핑 헬퍼
// ----------------------------------------------------

// DB에서 반환될 스케줄 로우 타입 정의
interface ScheduleRow extends Omit<ScheduleEvent, 'id' | 'start' | 'end' | 'allDay'>, RowDataPacket {
    id: string; // 문자열 UUID
    start: string; 
    end: string;
    allDay: number; // DB에서 TINYINT(1)로 저장될 경우 number로 반환됨
}

// 헬퍼 함수: DB Row를 ScheduleEvent 타입으로 변환
const mapRowToScheduleEvent = (row: ScheduleRow): ScheduleEvent => ({
    ...row,
    id: row.id,
    // DB의 ISO string을 Date 객체로 변환
    start: new Date(row.start),
    end: new Date(row.end),
    // DB의 number(TINYINT)를 boolean으로 변환
    allDay: Boolean(row.allDay)
});


// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 스케줄 생성
 */
export const createSchedule = async (
    data: Omit<ScheduleEvent, 'id'>
): Promise<{ id: string }> => {
    const id = uuidv4();
    
    // Date 객체와 boolean 값을 DB에 맞게 문자열/number로 변환
    const values = [
        id,
        data.title,
        data.start.toISOString(),
        data.end.toISOString(),
        Number(data.allDay), 
        data.color, 
    ];
    
    // 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} 
        (id, title, start, end, allDay, color) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        values
    );

    return { id };
};

/**
 * 모든 스케줄 조회 (start 시간 기준 오름차순)
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
    // SQL 쿼리 실행
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start, end, allDay, color FROM ${TABLE_NAME} ORDER BY start ASC`
    );
    
    // 헬퍼 함수를 사용하여 타입에 맞게 매핑
    return rows.map(mapRowToScheduleEvent);
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
    // WHERE 조건에 id 사용
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start, end, allDay, color FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) return null;
    
    // 헬퍼 함수를 사용하여 타입에 맞게 매핑
    return mapRowToScheduleEvent(rows[0]);
};

/**
 * 스케줄 수정
 */
export const updateSchedule = async (
    id: string,
    data: Partial<Omit<ScheduleEvent, 'id'>>
): Promise<number> => { // affectedRows 반환
    
    const dataForDb: { [key: string]: any } = {};
    
    // ⭐️ TS7053 오류 수정: Object.keys의 결과를 data의 실제 키 타입으로 명시적으로 캐스팅합니다.
    const keysToUpdate = Object.keys(data) as Array<keyof typeof data>;

    for (const key of keysToUpdate) {
        // key는 data에 존재하는 것이 보장됨
        const value = data[key]; 
        
        // Partial 타입이므로 값이 undefined일 수 있습니다.
        if (value === undefined) continue; 
        
        if (value instanceof Date) {
            // Date 객체는 ISO string으로 변환
            dataForDb[key] = value.toISOString();
        } else if (typeof value === 'boolean') {
            // boolean은 0 또는 1로 변환
            dataForDb[key] = Number(value); 
        } else {
            dataForDb[key] = value;
        }
    }
    
    const dataEntries = Object.entries(dataForDb);

    if (dataEntries.length === 0) return 0;

    // SET 구문 생성을 위한 키-값 배열 준비
    const setClauses = dataEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = dataEntries.map(([, value]) => value);
    
    // UPDATE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id] // 값 배열 뒤에 WHERE 조건인 id 추가
    );
    
    // affectedRows 반환
    return result.affectedRows;
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (id: string): Promise<number> => { // affectedRows 반환
    // DELETE 쿼리 실행
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    // affectedRows 반환
    return result.affectedRows;
};