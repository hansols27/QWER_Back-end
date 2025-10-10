import { Router } from 'express';
import * as scheduleController from '../controllers/scheduleController';

const router = Router();

/**
 * 스케줄 CRUD 라우트
 * /api/schedules 기준으로 통일
 */

// ✅ POST: 스케줄 생성
router.post('/', scheduleController.createSchedule);

// ✅ GET: 모든 스케줄 조회
router.get('/', scheduleController.getSchedules);

// ✅ GET: 단일 스케줄 조회
router.get('/:id', scheduleController.getSchedule);

// ✅ PUT: 스케줄 수정
router.put('/:id', scheduleController.updateSchedule);

// ✅ DELETE: 스케줄 삭제
router.delete('/:id', scheduleController.deleteSchedule);

export default router;
