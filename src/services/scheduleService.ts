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

// ⭐️ 핵심 수정 함수: Date 객체를 MySQL DATETIME (로컬 시간 기준) 문자열로 변환
// 이 함수는 KST 기준의 시간을 'YYYY-MM-DD HH:mm:ss' 형식으로 만듭니다.
const toMySqlDatetime = (date: Date): string => {
    // 1. 로컬 타임존(KST)을 기준으로 오프셋을 계산합니다.
    const offset = date.getTimezoneOffset() * 60000; // Timezone offset in milliseconds
    
    // 2. UTC 시간을 로컬 시간으로 보정합니다. (밀려있는 시간을 다시 로컬로 당겨옴)
    const localTime = new Date(date.getTime() - offset);
    
    // 3. 'YYYY-MM-DD HH:mm:ss' 형식으로 문자열을 만듭니다.
    return localTime.toISOString().slice(0, 19).replace('T', ' ');
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
    
    // ⭐️ 수정: Date 객체를 그대로 사용하여 toMySqlDatetime 함수를 통해 KST 기준 시간 저장
    const startDate = data.start;
    const endDate = data.end;

    // MySQL DATETIME 형식으로 변환합니다. (KST 00:00:00 기준)
    const mysqlStart = toMySqlDatetime(startDate);
    const mysqlEnd = toMySqlDatetime(endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("유효하지 않은 시작/종료 날짜 형식입니다.");
    }

    // type에 기반하여 색상을 자동 결정
    const color = getColorByType(data.type);
    
    // ⭐️ 오류 해결: 바인드 변수에 undefined가 들어가지 않도록 null로 대체
    const values = [
        id,
        data.title || null,
        mysqlStart, // KST 기준 'YYYY-MM-DD HH:mm:ss' 형식으로 저장
        mysqlEnd,
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
            // ⭐️ 수정: Date 객체로 변환 후 toMySqlDatetime 함수를 통해 KST 기준으로 저장
            let dateValue: Date;
            if (value instanceof Date) {
                dateValue = value;
            } else {
                // 문자열일 경우 새로운 Date 객체 생성
                const dateString = value.toString().substring(0, 10);
                dateValue = new Date(dateString); // 단순 날짜 문자열로 생성
            }
            
            if (isNaN(dateValue.getTime())) {
                throw new Error(`유효하지 않은 날짜 형식입니다: ${key}`);
            }
            // KST 기준으로 포맷하여 저장
            dataForDb[key] = toMySqlDatetime(dateValue);
            
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