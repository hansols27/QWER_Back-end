import { db, bucket } from "../firebaseConfig";
import type { AlbumItem } from "@/types/album";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

// 모든 함수에서 필수 값 체크 및 에러 처리
export async function getAlbums(): Promise<AlbumItem[]> {
  const snapshot = await db.collection("albums").orderBy("date", "desc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as AlbumItem;
    return { ...data, id: doc.id };
  });
}

export async function getAlbumById(id: string): Promise<AlbumItem | null> {
  const doc = await db.collection("albums").doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as AlbumItem;
  return { ...data, id: doc.id };
}

export async function createAlbum(
  data: Partial<AlbumItem>,
  file?: Express.Multer.File
): Promise<AlbumItem> {
  if (!data.title || !data.date) throw new Error("Title and date are required");

  let imageUrl = "";
  if (file) {
    const fileRef = bucket.file(`albums/${uuidv4()}.png`);
    await fileRef.save(file.buffer, { contentType: file.mimetype, resumable: false });
    await fileRef.makePublic();
    imageUrl = fileRef.publicUrl();
  }

  const albumData: Omit<AlbumItem, "id"> = {
    title: data.title,
    date: data.date,
    description: data.description || "",
    tracks: data.tracks || [],
    videoUrl: data.videoUrl || "",
    image: imageUrl,
  };

  const docRef = await db.collection("albums").add(albumData);
  return { ...albumData, id: docRef.id };
}

export async function updateAlbum(
  id: string,
  data: Partial<AlbumItem>,
  file?: Express.Multer.File
): Promise<AlbumItem | null> {
  const docRef = db.collection("albums").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  let imageUrl = doc.data()?.image || "";
  if (file) {
    // 기존 이미지 삭제 (선택 사항)
    if (imageUrl) {
      const oldFileName = imageUrl.split("/").pop();
      if (oldFileName) await bucket.file(`albums/${oldFileName}`).delete().catch(() => null);
    }

    const fileRef = bucket.file(`albums/${uuidv4()}.png`);
    await fileRef.save(file.buffer, { contentType: file.mimetype, resumable: false });
    await fileRef.makePublic();
    imageUrl = fileRef.publicUrl();
  }

  const { id: _, ...rest } = data; // id 제거
  const updateData = { ...rest, image: imageUrl };
  await docRef.update(updateData);

  const updatedDoc = await docRef.get();
  const updatedData = updatedDoc.data() as AlbumItem;
  return { ...updatedData, id: updatedDoc.id };
}

export async function deleteAlbum(id: string): Promise<void> {
  const docRef = db.collection("albums").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return;

  // Storage 이미지 삭제
  const imageUrl = doc.data()?.image;
  if (imageUrl) {
    const fileName = imageUrl.split("/").pop();
    if (fileName) await bucket.file(`albums/${fileName}`).delete().catch(() => null);
  }

  await docRef.delete();
}
