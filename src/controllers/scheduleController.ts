import { Request, Response } from 'express';
import * as scheduleService from '@services/scheduleService';
import type { ScheduleEvent } from '@/types/schedule'; // 업데이트된 ScheduleEvent 타입을 사용

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// 1. 스케줄 생성 (POST)
// ----------------------------------------------------
/**
 * 스케줄 생성 후, 캘린더를 새로고침하기 위해 업데이트된 전체 목록을 반환합니다.
 */
export const createSchedule = async (req: Request, res: Response) => {
    try {
        // ⭐️ 수정: Omit 타입에 'color'를 추가하여, 클라이언트 입력 데이터에서 제외합니다.
        const data = req.body as Omit<ScheduleEvent, 'id' | 'color'>;
        
        // 1. 서비스에서 ID를 생성하여 스케줄 저장
        await scheduleService.createSchedule(data); 
        
        // 2. 저장 후 업데이트된 전체 스케줄 목록을 조회합니다.
        const schedules = await scheduleService.getAllSchedules();
        
        // 생성 완료 시 201 Created와 업데이트된 목록 반환
        res.status(201).json({ success: true, data: schedules });
    } catch (err) {
        console.error("POST /schedule 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

// ----------------------------------------------------
// 2. 모든 스케줄 조회 (GET)
// ----------------------------------------------------
/**
 * 모든 스케줄 조회
 */
export const getSchedules = async (req: Request, res: Response) => {
    try {
        const schedules = await scheduleService.getAllSchedules();
        res.status(200).json({ success: true, data: schedules });
    } catch (err) {
        console.error("GET /schedule 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

// ----------------------------------------------------
// 3. 단일 스케줄 조회 (GET /:id)
// ----------------------------------------------------
/**
 * 단일 스케줄 조회
 */
export const getSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const schedule = await scheduleService.getScheduleById(id);
        if (!schedule) {
            return res.status(404).json({ success: false, message: '스케줄을 찾을 수 없습니다.' });
        }
        res.status(200).json({ success: true, data: schedule });
    } catch (err) {
        console.error("GET /schedule/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

// ----------------------------------------------------
// 4. 스케줄 수정 (PUT /:id)
// ----------------------------------------------------
/**
 * 스케줄 수정 후, 캘린더를 새로고침하기 위해 업데이트된 전체 목록을 반환합니다.
 */
export const updateSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        // Partial<Omit<ScheduleEvent, 'id'>>는 color를 수정할 수 있도록 허용합니다. (Type 변경 시 color 자동 업데이트 로직과 충돌 없음)
        const data = req.body as Partial<Omit<ScheduleEvent, 'id'>>; 
        
        // 1. 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
        const affectedRows = await scheduleService.updateSchedule(id, data);
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: '수정할 스케줄을 찾을 수 없습니다.' });
        }
        
        // 2. 수정 후 업데이트된 전체 스케줄 목록을 조회합니다.
        const schedules = await scheduleService.getAllSchedules();
        
        // 수정 완료 시 200 OK와 업데이트된 목록 반환
        res.status(200).json({ success: true, message: '스케줄 수정 완료', data: schedules });
    } catch (err) {
        console.error("PUT /schedule/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

// ----------------------------------------------------
// 5. 스케줄 삭제 (DELETE /:id)
// ----------------------------------------------------
/**
 * 스케줄 삭제 후, 캘린더를 새로고침하기 위해 업데이트된 전체 목록을 반환합니다.
 */
export const deleteSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        
        // 1. 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
        const affectedRows = await scheduleService.deleteSchedule(id);
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: '삭제할 스케줄을 찾을 수 없습니다.' });
        }
        
        // 2. 삭제 후 업데이트된 전체 스케줄 목록을 조회합니다.
        const schedules = await scheduleService.getAllSchedules();
        
        // 삭제 완료 시 200 OK와 업데이트된 목록 반환
        res.status(200).json({ success: true, message: '스케줄 삭제 완료', data: schedules });
    } catch (err) {
        console.error("DELETE /schedule/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};