import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import type { MemberPayload, MemberContentPayloadItem, MemberSNS } from "@/types/member";
import { ResultSetHeader } from 'mysql2/promise';
import pool from "../config/db-config"; 
import { uploadBufferToStorage } from "../utils/aws-s3-upload";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const TABLE_NAME = "settings";

// 헬퍼: 오류 메시지 추출
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// GET /api/members (최신 10개 조회, 테스트용)
// ----------------------------------------------------
router.get("/", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} LIMIT 10`);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("GET /members 쿼리 오류:", err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// GET /api/members/all (전체 조회)
// ----------------------------------------------------
router.get("/all", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME}`);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("GET /members/all 쿼리 오류:", err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// GET /api/members/:id (단일 row 조회)
// ----------------------------------------------------
router.get("/:id", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} WHERE id = 1`);
        const data = rows as any[];
        if (data.length === 0) {
            return res.status(404).json({ success: false, message: "설정 정보를 찾을 수 없습니다." });
        }
        res.status(200).json({ success: true, data: data[0] });
    } catch (err) {
        console.error("GET /members/:id 오류:", err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// POST /api/members (S3 이미지 업로드 + settings 업데이트)
// ----------------------------------------------------
router.post("/", upload.array("images"), async (req: Request, res: Response) => {
    try {
        if (!req.body.payload) {
            return res.status(400).json({ success: false, message: "payload가 필요합니다." });
        }

        const data: MemberPayload =
            typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;

        const files = req.files as Express.Multer.File[] | undefined;
        const uploadedImages: string[] = [];

        // 1️⃣ AWS S3 업로드
        if (files?.length) {
            for (const file of files) {
                const ext = file.mimetype.split("/").pop() || "png";
                const destPath = `settings/main/${uuidv4()}.${ext}`;
                try {
                    const imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
                    uploadedImages.push(imageUrl);
                } catch (err) {
                    console.error("S3 업로드 실패:", err);
                }
            }
        }

        // 2️⃣ contents 이미지 URL 매핑
        const contentsWithImages: MemberContentPayloadItem[] = (data.contents || []).map(c =>
            c.type === "image" ? { type: "image", content: uploadedImages.shift() || c.content } : c
        );

        // 3️⃣ SNS, tracks JSON 변환
        const snsJson = JSON.stringify(data.sns || {});
        const tracksJson = JSON.stringify(data.tracks || []);

        // 4️⃣ settings 테이블 INSERT / UPDATE
        const query = `
            INSERT INTO ${TABLE_NAME} (id, main_image, sns_links, contents, tracks)
            VALUES (1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                main_image = VALUES(main_image),
                sns_links = VALUES(sns_links),
                contents = VALUES(contents),
                tracks = VALUES(tracks)
        `;

        await pool.execute<ResultSetHeader>(query, [
            uploadedImages[0] || data.mainImage || null,
            snsJson,
            JSON.stringify(contentsWithImages),
            tracksJson
        ]);

        res.status(200).json({
            success: true,
            data: {
                mainImage: uploadedImages[0] || data.mainImage || null,
                contents: contentsWithImages,
                sns: data.sns || {},
                tracks: data.tracks || [],
                type: data.type,
                id: data.id,
                name: data.name
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to save settings: ${getErrorMessage(err)}` });
    }
});

export default router;
