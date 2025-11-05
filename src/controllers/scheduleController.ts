import { Request, Response } from 'express';
import * as scheduleService from '@services/scheduleService';
import type { ScheduleEvent } from '@/types/schedule';

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

/**
 * 스케줄 생성
 */
export const createSchedule = async (req: Request, res: Response) => {
    try {
        const data = req.body as Omit<ScheduleEvent, 'id'>;
        // 서비스에서 ID를 생성하여 반환합니다.
        const result = await scheduleService.createSchedule(data); 
        // 생성 완료 시 201 Created
        res.status(201).json({ success: true, data: { id: result.id } });
    } catch (err) {
        console.error("POST /schedule 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

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

/**
 * 스케줄 수정
 */
export const updateSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const data = req.body as Partial<Omit<ScheduleEvent, 'id'>>;
        
        // ⭐️ 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
        const affectedRows = await scheduleService.updateSchedule(id, data);
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: '수정할 스케줄을 찾을 수 없습니다.' });
        }
        
        res.status(200).json({ success: true, message: '스케줄 수정 완료' });
    } catch (err) {
        console.error("PUT /schedule/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        
        // ⭐️ 서비스에서 affectedRows를 받아 대상이 있었는지 확인합니다.
        const affectedRows = await scheduleService.deleteSchedule(id);
        
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: '삭제할 스케줄을 찾을 수 없습니다.' });
        }
        
        res.status(200).json({ success: true, message: '스케줄 삭제 완료' });
    } catch (err) {
        console.error("DELETE /schedule/:id 오류:", err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};