import { Router } from "express";
import multer from "multer";
import { bucket, db } from "../firebaseConfig";
import type { MemberPayload } from "@/types/member";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/member
router.post("/", upload.array("images"), async (req, res) => {
  try {
    // payload 타입 안전하게 파싱
    if (!req.body.payload) {
      return res.status(400).json({ success: false, message: "payload가 필요합니다." });
    }

    const data: MemberPayload =
      typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;

    const files = req.files as Express.Multer.File[] | undefined;

    // 🔹 이미지 업로드
    const uploadedImages: string[] = [];
    if (files?.length) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${data.id}${String(i + 1).padStart(2, "0")}.png`;
        const fileRef = bucket.file(`images/members/${fileName}`);
        await fileRef.save(file.buffer, { contentType: file.mimetype, resumable: false });
        await fileRef.makePublic();
        uploadedImages.push(fileRef.publicUrl());
      }
    }

    // 🔹 contents 이미지 URL 매핑
    const contentsWithImages = data.contents.map((c) =>
      c.type === "image" ? { ...c, content: uploadedImages.shift() || c.content || "" } : c
    );

    // 🔹 Firestore 저장
    await db.collection("members").doc(data.id).set({
      ...data,
      contents: contentsWithImages,
    }, { merge: true }); // merge: 기존 데이터 유지 가능

    res.status(200).json({ success: true, data: { ...data, contents: contentsWithImages } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save member" });
  }
});

export default router;
