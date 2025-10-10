import { db } from "../firebaseConfig";
import type { Notice } from "@/types/notice";

// ✅ 목록 조회
export async function getNotices(): Promise<(Notice & { id: string })[]> {
  const snapshot = await db.collection("notices").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as Notice;
    // 혹시 data 안에 id가 있으면 제거
    const { id: _ignore, ...rest } = data;
    return { id: doc.id, ...rest };
  });
}

// ✅ 상세 조회
export async function getNotice(id: string): Promise<Notice & { id: string }> {
  const doc = await db.collection("notices").doc(id).get();
  if (!doc.exists) throw new Error("Notice not found");

  const data = doc.data() as Notice;
  const { id: _ignore, ...rest } = data;
  return { id: doc.id, ...rest };
}

// ✅ 등록
export async function createNotice(data: { type: string; title: string; content: string }): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const ref = await db.collection("notices").add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { id: ref.id };
}

// ✅ 수정
export async function updateNotice(
  id: string,
  data: Partial<{ type: string; title: string; content: string }>
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db.collection("notices").doc(id).update({
    ...data,
    updatedAt,
  });
}

// ✅ 삭제
export async function deleteNotice(id: string): Promise<void> {
  await db.collection("notices").doc(id).delete();
}
