import { Request, Response } from 'express';
// ⭐️ 이 경로는 MariaDB 기반의 새로운 scheduleService 파일을 바라봅니다.
import * as scheduleService from '../services/scheduleService';
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
        // scheduleService 함수 서명이 유지되어 그대로 호출 가능합니다.
        const result = await scheduleService.createSchedule(data); 
        res.status(201).json({ success: true, data: { id: result.id } });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
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
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
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
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
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
        await scheduleService.updateSchedule(id, data);
        res.status(200).json({ success: true, message: '스케줄 수정 완료' });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await scheduleService.deleteSchedule(id);
        res.status(200).json({ success: true, message: '스케줄 삭제 완료' });
    } catch (err) {
        console.error(err);
        // ⭐️ 오류 타입 처리 개선 적용
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};