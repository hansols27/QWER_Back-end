import { db } from '../firebaseConfig';
import type { ScheduleEvent } from '@/types/schedule';
import { v4 as uuidv4 } from 'uuid';

/**
 * 스케줄 생성
 * Firestore 문서에는 id 필드 저장하지 않고, docId만 사용
 */
export const createSchedule = async (
  data: Omit<ScheduleEvent, 'id'>
): Promise<{ id: string }> => {
  const id = uuidv4();
  await db.collection('schedules').doc(id).set(data); // id는 문서에 저장하지 않음
  return { id };
};

/**
 * 모든 스케줄 조회
 * 읽을 때만 doc.id를 포함
 */
export const getAllSchedules = async (): Promise<ScheduleEvent[]> => {
  const snap = await db.collection('schedules').orderBy('startTime', 'asc').get();
  return snap.docs.map(doc => {
    const data = doc.data() as Omit<ScheduleEvent, 'id'>;
    return { id: doc.id, ...data };
  });
};

/**
 * 단일 스케줄 조회
 */
export const getScheduleById = async (id: string): Promise<ScheduleEvent | null> => {
  const doc = await db.collection('schedules').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as Omit<ScheduleEvent, 'id'>;
  return { id: doc.id, ...data };
};

/**
 * 스케줄 수정
 */
export const updateSchedule = async (
  id: string,
  data: Partial<Omit<ScheduleEvent, 'id'>>
): Promise<void> => {
  await db.collection('schedules').doc(id).set(data, { merge: true });
};

/**
 * 스케줄 삭제
 */
export const deleteSchedule = async (id: string): Promise<void> => {
  await db.collection('schedules').doc(id).delete();
};
