// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "@config/db-config"; 
import type { ScheduleEvent, EventType } from '@/types/schedule'; 
import { v4 as uuidv4 } from 'uuid'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "schedules"; // MariaDB 테이블 이름

// ----------------------------------------------------
// 1. 타입 정의 및 헬퍼 함수
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

// ⭐️ 일정 유형에 따라 색상 결정 헬퍼 함수
const getColorByType = (type: EventType): string => {
    switch (type) {
        case 'B': // Birthday
            return '#ff9800'; 
        case 'C': // Concert
            return '#2196f3';
        case 'E': // Event
            return '#4caf50';
        default:
            return '#9e9e9e'; // 기본값 (회색)
    }
}


// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 스케줄 생성
 */
export const createSchedule = async (
    data: Omit<ScheduleEvent, 'id' | 'color'>
): Promise<{ id: string }> => {
    const id = uuidv4();
    
    // ⭐️ 수정: 시간대 문제 해결. 날짜 문자열에 UTC 자정 시간을 강제 지정하여 Date 객체 생성
    const startString = data.start.toString().substring(0, 10); 
    const endString = data.end.toString().substring(0, 10);
    
    const startDate = new Date(`${startString}T00:00:00Z`);
    const endDate = new Date(`${endString}T00:00:00Z`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("유효하지 않은 시작/종료 날짜 형식입니다.");
    }

    // type에 기반하여 색상을 자동 결정
    const color = getColorByType(data.type);
    
    // ⭐️ 오류 해결: 바인드 변수에 undefined가 들어가지 않도록 null로 대체
    const values = [
        id,
        data.title || null,
        startDate.toISOString(), // UTC 00:00:00으로 저장
        endDate.toISOString(),
        Number(data.allDay), 
        color, // 결정된 color 값 사용
        data.type || null, 
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
 * 모든 스케줄 조회
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start, end, allDay, color, type FROM ${TABLE_NAME} ORDER BY start ASC`
    );
    return rows.map(mapRowToScheduleEvent);
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
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
): Promise<number> => { 
    
    const dataForDb: { [key: string]: any } = {};
    
    const keysToUpdate = Object.keys(data) as Array<keyof typeof data>;

    for (const key of keysToUpdate) {
        const value = data[key]; 
        
        if (value === undefined) continue; 
        
        // start/end 날짜 처리 (시간대 문제 방지 로직 적용)
        if (key === 'start' || key === 'end') {
            // ⭐️ 수정: Date 객체가 아닌 날짜 문자열이 들어올 경우, UTC 자정으로 변환 후 저장
            let dateValue: Date;
            if (value instanceof Date) {
                dateValue = value;
            } else {
                const dateString = value.toString().substring(0, 10);
                dateValue = new Date(`${dateString}T00:00:00Z`);
            }
            
            if (isNaN(dateValue.getTime())) {
                throw new Error(`유효하지 않은 날짜 형식입니다: ${key}`);
            }
            dataForDb[key] = dateValue.toISOString();
            
        } 
        // allDay 처리
        else if (key === 'allDay') { 
            dataForDb[key] = Number(value as boolean); 
            
        }
        // ⭐️ type이 수정될 경우 color도 함께 업데이트
        else if (key === 'type') {
            const newType = value as EventType;
            dataForDb[key] = newType;
            // type이 수정되면 color도 업데이트
            dataForDb['color'] = getColorByType(newType); 
        }
        // title, color (단순 문자열) 처리
        else {
            // color 필드는 type 변경시 자동으로 업데이트 되나, 혹시 모를 direct 업데이트 방지
            if(key === 'color') continue; 
            
            dataForDb[key] = value || null; // null 처리
        }
    }
    
    const dataEntries = Object.entries(dataForDb);

    if (dataEntries.length === 0) return 0;

    const setClauses = dataEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = dataEntries.map(([, value]) => value);
    
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE ${TABLE_NAME} SET ${setClauses} WHERE id = ?`, 
        [...values, id]
    );
    
    return result.affectedRows;
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (id: string): Promise<number> => {
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    return result.affectedRows;
};