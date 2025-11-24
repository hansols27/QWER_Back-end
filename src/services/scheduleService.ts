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
    
    // ⭐️ 수정: 클라이언트에서 문자열로 넘어올 수 있는 data.start/end를 안전하게 Date 객체로 변환
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);

    // 유효성 검사
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("유효하지 않은 시작/종료 날짜 형식입니다.");
    }
    
    // Date 객체와 boolean 값을 DB에 맞게 문자열/number로 변환
    const values = [
        id,
        data.title,
        startDate.toISOString(),
        endDate.toISOString(),
        Number(data.allDay), 
        data.color, 
        data.type, // type 추가
    ];
    
    // 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} 
        (id, title, start, end, allDay, color, type) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values
    );

    return { id };
};

/**
 * 모든 스케줄 조회 (start 시간 기준 오름차순)
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
    // 쿼리에 type 필드 추가
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start, end, allDay, color, type FROM ${TABLE_NAME} ORDER BY start ASC`
    );
    
    return rows.map(mapRowToScheduleEvent);
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
    // 쿼리에 type 필드 추가
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start, end, allDay, color, type FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );

    if (rows.length === 0) return null;
    
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
    
    const keysToUpdate = Object.keys(data) as Array<keyof typeof data>;

    for (const key of keysToUpdate) {
        const value = data[key]; 
        
        if (value === undefined) continue; 
        
        // ⭐️ 수정: key에 따라 타입을 좁히고 처리 로직 분리
        if (key === 'start' || key === 'end') {
            // value가 Date 객체라면 그대로, 문자열이라면 new Date()로 변환 시도
            // new Date()에 string | number 타입만 전달되도록 타입 단언 사용
            const dateValue = value instanceof Date ? value : new Date(value as string | number);
            
            if (isNaN(dateValue.getTime())) {
                throw new Error(`유효하지 않은 날짜 형식입니다: ${key}`);
            }
            dataForDb[key] = dateValue.toISOString();
            
        } else if (key === 'allDay') { 
            // allDay는 boolean 타입 (혹은 Partial에 의해 boolean이 아닐 수 있으나, boolean으로 가정)
            dataForDb[key] = Number(value as boolean); 
            
        } else {
            // title, type, color 등 문자열 값
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