// ⭐️ 생성한 DB 연결 풀 모듈 임포트 경로 확인
import pool from "@config/db-config"; 
// ⭐️ 타입 변경: ScheduleEvent의 속성 이름도 start_date, end_date, schedule_type으로 변경되었다고 가정합니다.
import type { ScheduleEvent, EventType } from '@/types/schedule'; 
import { v4 as uuidv4 } from 'uuid'; 
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const TABLE_NAME = "schedules"; // MariaDB 테이블 이름

// ----------------------------------------------------
// 1. 타입 정의 및 헬퍼 함수
// ----------------------------------------------------

// ⭐️ DB에서 반환될 스케줄 로우 타입 정의 (새 컬럼 이름 반영)
interface ScheduleRow extends Omit<ScheduleEvent, 'id' | 'start' | 'end' | 'allDay' | 'type'>, RowDataPacket {
    id: string; // 문자열 UUID
    start_date: string; // DATE 타입으로 저장될 YYYY-MM-DD 문자열
    end_date: string;   // DATE 타입으로 저장될 YYYY-MM-DD 문자열
    allDay: number; // DB에서 TINYINT(1)로 저장될 경우 number로 반환됨
    schedule_type: EventType; // 새 컬럼 이름
}

// ⭐️ 헬퍼 함수: DB Row를 ScheduleEvent 타입으로 변환 (새 컬럼 이름 반영)
const mapRowToScheduleEvent = (row: ScheduleRow): ScheduleEvent => ({
    id: row.id,
    title: row.title,
    // DB의 YYYY-MM-DD 문자열을 KST 00:00:00 기준으로 Date 객체로 변환
    start: new Date(row.start_date), // Date-Only 문자열은 시간대 문제 없이 로컬 자정으로 파싱됨
    end: new Date(row.end_date), 
    // DB의 number(TINYINT)를 boolean으로 변환
    allDay: Boolean(row.allDay),
    color: row.color,
    type: row.schedule_type,
});

// 일정 유형에 따라 색상 결정 헬퍼 함수 (변경 없음)
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

// ⭐️ 핵심 수정 함수: Date 객체에서 순수한 날짜 문자열(YYYY-MM-DD)만 추출
// 이렇게 하면 시간대 오프셋에 관계없이 날짜만 DB에 저장되어 하루 밀림 현상이 방지됩니다.
const toMySqlDate = (date: Date): string => {
    // 클라이언트에서 '2025-11-26 00:00:00 KST'를 보냈을 때, Date 객체는 내부적으로 UTC로 저장됨.
    // Date 객체의 메서드를 이용해 로컬 시간 기준의 연/월/일을 추출하여 YYYY-MM-DD 포맷을 만듭니다.
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// ----------------------------------------------------
// 2. DB 쿼리 실행 함수들
// ----------------------------------------------------

/**
 * 스케줄 생성
 */
export const createSchedule = async (
    // ⭐️ 타입 변경: 입력 데이터의 속성 이름도 DB와 일치시킵니다.
    data: { id?: string; title: string; start: Date; end: Date; allDay: boolean; type: EventType }
): Promise<{ id: string }> => {
    const id = uuidv4();
    
    const startDate = data.start;
    const endDate = data.end;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("유효하지 않은 시작/종료 날짜 형식입니다.");
    }

    // ⭐️ 핵심 변경: 순수 날짜 문자열(YYYY-MM-DD)로 변환
    const mysqlStart = toMySqlDate(startDate);
    const mysqlEnd = toMySqlDate(endDate);
    
    // type에 기반하여 색상을 자동 결정
    const color = getColorByType(data.type);
    
    // 바인드 변수에 undefined가 들어가지 않도록 null로 대체
    const values = [
        id,
        data.title || null,
        mysqlStart, // YYYY-MM-DD 형식으로 저장
        mysqlEnd,
        Number(data.allDay), 
        color, 
        data.type || null, 
    ];
    
    // ⭐️ 컬럼 이름 변경 및 백틱 제거 (깔끔한 쿼리)
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} 
        (id, title, start_date, end_date, allDay, color, schedule_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values
    );

    return { id };
};

/**
 * 모든 스케줄 조회
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
    // ⭐️ 컬럼 이름 변경 및 백틱 제거
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start_date, end_date, allDay, color, schedule_type FROM ${TABLE_NAME} ORDER BY start_date ASC`
    );
    return rows.map(mapRowToScheduleEvent);
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
    // ⭐️ 컬럼 이름 변경 및 백틱 제거
    const [rows] = await pool.execute<ScheduleRow[]>(
        `SELECT id, title, start_date, end_date, allDay, color, schedule_type FROM ${TABLE_NAME} WHERE id = ?`, 
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
    // ⭐️ 타입 변경: 입력 데이터의 속성 이름도 DB와 일치시킵니다.
    data: Partial<{ title: string; start: Date; end: Date; allDay: boolean; type: EventType }> 
): Promise<number> => { 
    
    const dataForDb: { [key: string]: any } = {};
    
    const keysToUpdate = Object.keys(data) as Array<keyof typeof data>;

    for (const key of keysToUpdate) {
        const value = data[key]; 
        
        if (value === undefined) continue; 
        
        // ⭐️ start/end 날짜 처리 (새 컬럼 이름 사용)
        if (key === 'start' || key === 'end') {
            const newKey = key === 'start' ? 'start_date' : 'end_date';
            let dateValue: Date;
            
            if (value instanceof Date) {
                dateValue = value;
            } else if (typeof value === 'string') {
                // 문자열일 경우 새로운 Date 객체 생성. YYYY-MM-DDT00:00:00 형식으로 파싱해야 정확함.
                dateValue = new Date(`${value.substring(0, 10)}T00:00:00`); 
            } else {
                throw new Error(`유효하지 않은 날짜 형식입니다: ${key}`);
            }
            
            if (isNaN(dateValue.getTime())) {
                throw new Error(`유효하지 않은 날짜 형식입니다: ${key}`);
            }
            // ⭐️ 핵심 변경: 순수 날짜 문자열로 변환하여 저장
            dataForDb[newKey] = toMySqlDate(dateValue);
            
        } 
        // allDay 처리
        else if (key === 'allDay') { 
            dataForDb[key] = Number(value as boolean); 
            
        }
        // ⭐️ type 처리 (새 컬럼 이름 사용)
        else if (key === 'type') {
            const newType = value as EventType;
            dataForDb['schedule_type'] = newType;
            // type이 수정되면 color도 업데이트
            dataForDb['color'] = getColorByType(newType); 
        }
        // title, color (단순 문자열) 처리
        else {
            // color 필드는 type 변경시 자동으로 업데이트 되나, 혹시 모를 direct 업데이트 방지
            
            // ⭐️ 수정: key를 string으로 단언하여 TS2367 경고를 해결하고, 로직을 유지합니다.
            if((key as string) === 'color') continue; 
            
            dataForDb[key] = value || null; // title 또는 기타 필드 처리
        }
    }
    
    const dataEntries = Object.entries(dataForDb);

    if (dataEntries.length === 0) return 0;

    // ⭐️ 컬럼 이름 변경 및 백틱 제거
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
    // 백틱 제거
    const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TABLE_NAME} WHERE id = ?`, 
        [id]
    );
    
    return result.affectedRows;
};