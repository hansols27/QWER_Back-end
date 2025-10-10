import { db, bucket } from "../firebaseConfig";
import type { GalleryItem } from "@/types/gallery";
import { v4 as uuidv4 } from "uuid";

// 갤러리 목록 조회
export const getGalleryItems = async (): Promise<GalleryItem[]> => {
  const snapshot = await db.collection("gallery").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as { url: string; createdAt: string };
    return { id: doc.id, url: data.url, createdAt: data.createdAt };
  });
};

// 이미지 업로드
export const uploadGalleryImages = async (files: Express.Multer.File[]): Promise<GalleryItem[]> => {
  if (!files || files.length === 0) return [];

  const uploadedItems: GalleryItem[] = [];

  for (const file of files) {
    const fileName = `gallery/${uuidv4()}.png`;
    const fileRef = bucket.file(fileName);

    try {
      await fileRef.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
      });
      await fileRef.makePublic();
    } catch (err) {
      console.error("Failed to upload file:", file.originalname, err);
      continue; // 실패한 파일은 스킵
    }

    const url = fileRef.publicUrl();
    const createdAt = new Date().toISOString();

    const docRef = await db.collection("gallery").add({ url, createdAt });
    uploadedItems.push({ id: docRef.id, url, createdAt });
  }

  return uploadedItems;
};

// 이미지 삭제
export const deleteGalleryImage = async (id: string): Promise<void> => {
  const docRef = db.collection("gallery").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new Error("Gallery item not found");

  const data = docSnap.data() as { url: string };
  const url = data.url;

  try {
    // Firebase Storage에서 파일 삭제
    const filePath = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
    const fileRef = bucket.file(filePath);
    await fileRef.delete();
  } catch (err) {
    console.error("Failed to delete file from storage:", url, err);
  }

  // Firestore 문서 삭제
  await docRef.delete();
};
