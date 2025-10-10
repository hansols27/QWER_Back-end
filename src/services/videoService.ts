import { db } from "../firebaseConfig";
import type { VideoItem } from "@/types/video";

const COLLECTION = "videos";

/**
 * 전체 영상 조회
 */
export async function getVideos(): Promise<VideoItem[]> {
  const snapshot = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snapshot.docs.map(doc => {
    const data = doc.data() as Omit<VideoItem, "id">;
    return { id: doc.id, ...data };
  });
}

/**
 * 단일 영상 조회
 */
export async function getVideoById(id: string): Promise<VideoItem | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as Omit<VideoItem, "id">;
  return { id: doc.id, ...data };
}

/**
 * 영상 등록
 */
export async function createVideo(data: Omit<VideoItem, "id">): Promise<VideoItem> {
  const docRef = await db.collection(COLLECTION).add(data);
  const docSnap = await docRef.get();
  const docData = docSnap.data() as Omit<VideoItem, "id">;
  return { id: docRef.id, ...docData };
}

/**
 * 영상 수정
 */
export async function updateVideo(id: string, data: Partial<Omit<VideoItem, "id">>): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

/**
 * 영상 삭제
 */
export async function deleteVideo(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete();
}
