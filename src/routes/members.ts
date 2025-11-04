import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import type { MemberPayload, MemberContentPayloadItem, MemberSNS } from "@/types/member";
import { ResultSetHeader } from 'mysql2/promise';
import pool from "../config/db-config"; 
import { uploadBufferToStorage } from "../utils/aws-s3-upload";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const TABLE_NAME = "members";

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// GET /api/members (최신 10명 조회)
// ----------------------------------------------------
router.get("/", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC LIMIT 10`);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("GET /members 오류:", err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// GET /api/members/all (전체 멤버 조회)
// ----------------------------------------------------
router.get("/All", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} ORDER BY name`);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("GET /members/all 오류:", err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// GET /api/members/:id (특정 멤버 조회)
// ----------------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const memberId = req.params.id;
        const [rows] = await pool.execute(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [memberId]);
        const data = rows as any[];
        if (data.length === 0) {
            return res.status(404).json({ success: false, message: "멤버를 찾을 수 없습니다." });
        }
        res.status(200).json({ success: true, data: data[0] });
    } catch (err) {
        console.error(`GET /members/${req.params.id} 오류:`, err);
        res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
});

// ----------------------------------------------------
// POST /api/members (멤버 생성/업데이트)
// ----------------------------------------------------
router.post("/", upload.array("images"), async (req: Request, res: Response) => {
    try {
        if (!req.body.payload) {
            return res.status(400).json({ success: false, message: "payload가 필요합니다." });
        }

        const data: MemberPayload =
            typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;

        if (!data.id || !data.name || !data.type) {
            return res.status(400).json({ success: false, message: "id, name, type은 필수입니다." });
        }

        const files = req.files as Express.Multer.File[] | undefined;
        const uploadedImages: string[] = [];

        // 1️⃣ AWS S3 업로드
        if (files?.length) {
            for (const file of files) {
                const ext = file.mimetype.split("/").pop() || "png";
                const destPath = `members/${data.id}/${uuidv4()}.${ext}`;
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

        // 3️⃣ JSON 변환
        const snsJson = JSON.stringify(data.sns || {});
        const tracksJson = JSON.stringify(data.tracks || []);

        // 4️⃣ INSERT OR UPDATE
        const query = `
            INSERT INTO ${TABLE_NAME} (id, name, type, main_image, tracks, contents, sns_links)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                type = VALUES(type),
                main_image = VALUES(main_image),
                tracks = VALUES(tracks),
                contents = VALUES(contents),
                sns_links = VALUES(sns_links)
        `;

        await pool.execute<ResultSetHeader>(query, [
            data.id,
            data.name,
            data.type,
            uploadedImages[0] || null,
            tracksJson,
            JSON.stringify(contentsWithImages),
            snsJson
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...data,
                mainImage: uploadedImages[0] || null,
                contents: contentsWithImages
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to save member: ${getErrorMessage(err)}` });
    }
});

export default router;
