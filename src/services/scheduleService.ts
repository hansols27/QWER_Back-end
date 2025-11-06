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
// ScheduleEvent와 타입이 충돌하거나 DB에서 다르게 처리되는 필드를 Omit 합니다.
interface ScheduleRow extends Omit<ScheduleEvent, 'id' | 'start' | 'end' | 'allDay'>, RowDataPacket {
    id: string; // 문자열 UUID
    // DB에서 string 또는 boolean 형태로 반환되는 필드를 명시합니다.
    start: string; 
    end: string;
    allDay: number; // DB에서 TINYINT(1)로 저장될 경우 number로 반환될 수 있음
}

// 헬퍼 함수: DB Row를 ScheduleEvent 타입으로 변환
const mapRowToScheduleEvent = (row: ScheduleRow): ScheduleEvent => ({
    ...row,
    id: row.id,
    // ScheduleEvent가 start와 end를 Date 객체로 요구한다면, 여기서 변환해야 합니다.
    // 현재 코드에서는 string으로 처리하고 있으나, Date로 가정하고 변환 로직을 추가합니다.
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
    // 1. UUID 생성
    const id = uuidv4();
    
    // 🚨 Date 객체를 DB에 삽입하기 위해 문자열로 변환해야 합니다.
    const dataForDb = { 
        ...data, 
        start: data.start.toISOString(),
        end: data.end.toISOString(),
    };

    // 2. 쿼리 구성 간결화: keys, placeholders, values 배열 생성
    const dataWithId = { id, ...dataForDb };
    const keys = Object.keys(dataWithId);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(dataWithId);

    // 3. 데이터 삽입 쿼리 실행
    await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TABLE_NAME} (${keys.join(', ')}) VALUES (${placeholders})`,
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
        `SELECT * FROM ${TABLE_NAME} ORDER BY start ASC`
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
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`, 
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
    
    // 🚨 Date 객체가 포함될 경우 DB에 맞게 문자열로 변환해야 합니다.
    const dataForDb: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key as keyof typeof data];
        if (value instanceof Date) {
            dataForDb[key] = value.toISOString();
        } else {
            dataForDb[key] = value;
        }
    }
    
    // SET 구문 생성을 위한 키-값 배열 준비
    const setClauses = Object.keys(dataForDb).map(key => `${key} = ?`).join(', ');
    const values = Object.values(dataForDb);
    
    if (setClauses.length === 0) return 0;

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