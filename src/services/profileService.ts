import { db } from '../firebaseConfig';
import { uploadBufferToStorage } from '../utils/upload';
import { MemberPayload, MemberState } from '@/types/member';
import type { Express } from 'express';

/**
 * Admin에서 받은 상태(MemberState)를 Firestore에 저장 가능한 형태(MemberPayload)로 변환 후 저장
 */
export const saveProfile = async (
  id: string,
  name: string,
  data: MemberState,
  files?: Express.Multer.File[]
): Promise<{ contentsUrls: string[] }> => {
  const imageUrls: string[] = [];

  // 🔹 이미지 업로드
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const idx = String(i + 1).padStart(2, '0'); // 01, 02, ...
      const destPath = `members/${id}${idx}.png`;
      const url = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
      imageUrls.push(url);
    }
  }

  // 🔹 MemberPayload로 변환
  const payload: MemberPayload = {
    id,
    name,
    contents: [
      ...data.text.map(t => ({ type: 'text' as const, content: t })),
      ...data.image.map((img, i) => ({
        type: 'image' as const,
        content: typeof img === 'string' ? img : imageUrls[i] ?? ''
      }))
    ],
    sns: data.sns ?? {}
  };

  // 🔹 Firestore 저장
  await db.collection('profiles').doc(id).set(payload, { merge: true });

  return { contentsUrls: imageUrls };
};

/**
 * Firestore에서 프로필 조회
 */
export const getProfileById = async (id: string): Promise<MemberPayload | null> => {
  const doc = await db.collection('profiles').doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as MemberPayload;
};
