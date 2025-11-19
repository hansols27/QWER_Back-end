import { Router } from 'express';
import * as scheduleController from '@controllers/scheduleController'; 

const router = Router();

// ----------------------------------------------------
// GET /schedules (모든 스케줄 조회)
// ----------------------------------------------------
router.get('/', scheduleController.getSchedules); 

// ----------------------------------------------------
// GET /schedules/:id (단일 스케줄 조회)
// ----------------------------------------------------
router.get('/:id', scheduleController.getSchedule);

// ----------------------------------------------------
// POST /schedules (스케줄 생성 및 업데이트, Upsert)
// ----------------------------------------------------
router.post('/', scheduleController.createSchedule); 
router.put('/:id', scheduleController.updateSchedule);


// ----------------------------------------------------
// DELETE /schedules/:id (스케줄 삭제)
// ----------------------------------------------------
router.delete('/:id', scheduleController.deleteSchedule);


export default router;