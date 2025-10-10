import { Request, Response } from 'express';
import * as scheduleService from '../services/scheduleService';
import type { ScheduleEvent } from '@/types/schedule';

/**
 * 스케줄 생성
 */
export const createSchedule = async (req: Request, res: Response) => {
  try {
    const data = req.body as Omit<ScheduleEvent, 'id'>;
    const result = await scheduleService.createSchedule(data);
    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: (err as Error).message });
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
    res.status(500).json({ success: false, error: (err as Error).message });
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
    res.status(500).json({ success: false, error: (err as Error).message });
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
    res.status(500).json({ success: false, error: (err as Error).message });
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
    res.status(500).json({ success: false, error: (err as Error).message });
  }
};
