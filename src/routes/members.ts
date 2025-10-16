import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import type { MemberPayload, MemberContentItem } from "@/types/member";
import { ResultSetHeader } from 'mysql2/promise';

// ⭐️ MariaDB 연결 풀 임포트
import pool from "../config/db-config"; 
// ⭐️ AWS S3 버퍼 업로드 및 설정 파일 임포트
import { uploadBufferToStorage } from "../utils/aws-s3-upload";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const TABLE_NAME = "members";

// 헬퍼 함수: 오류 메시지 추출 (TypeScript 'unknown' 처리)
const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "알 수 없는 오류가 발생했습니다.";
};

// ----------------------------------------------------
// GET /api/members (멤버 프로필 목록 조회 - DB 연결 테스트용)
// ----------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
    try {
        // ⭐️ DB 연결 및 쿼리 테스트 ⭐️
        // members 테이블이 존재하는지 확인하고, 최대 10개의 멤버만 조회합니다.
        const [rows] = await pool.execute(`SELECT id, name, type FROM ${TABLE_NAME} LIMIT 10`);
        
        // 성공 응답: 데이터가 비어있어도 DB 연결 및 쿼리는 성공한 것임
        res.status(200).json({ 
            success: true, 
            message: "Member list retrieved successfully. DB connection verified.",
            data: rows 
        });

    } catch (err) {
        // DB 연결 오류, SQL 구문 오류 등이 발생했을 때
        console.error("GET /members 쿼리 실행 오류:", err);
        res.status(500).json({ 
            success: false, 
            message: `Failed to retrieve members: ${getErrorMessage(err)}` 
        });
    }
});

// ----------------------------------------------------
// POST /api/members (프로필 생성/업데이트)
// ----------------------------------------------------
router.post("/", upload.array("images"), async (req: Request, res: Response) => {
    try {
        if (!req.body.payload) {
            return res.status(400).json({ success: false, message: "payload가 필요합니다." });
        }

        const data: MemberPayload =
            typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;

        if (!data.id) {
            return res.status(400).json({ success: false, message: "Member ID (id)는 필수입니다." });
        }

        const files = req.files as Express.Multer.File[] | undefined;
        const uploadedImages: string[] = [];
        
        // 🔹 1. AWS S3에 이미지 업로드
        if (files?.length) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
                // 경로: members/MEMBER_ID/UUID.ext
                const destPath = `members/${data.id}/${uuidv4()}.${mimeTypeExtension}`;
                
                try {
                    const imageUrl = await uploadBufferToStorage(file.buffer, destPath, file.mimetype);
                    uploadedImages.push(imageUrl);
                } catch (uploadErr) {
                    console.error("S3 파일 업로드 실패:", uploadErr);
                }
            }
        }

        // 🔹 2. contents 이미지 URL 매핑
        const contentsWithImages: MemberContentItem[] = data.contents.map((c) =>
            c.type === "image" ? { ...c, content: uploadedImages.shift() || c.content || "" } : c
        );

        // 🔹 3. MariaDB 저장 (UPDATE OR INSERT)
        const tracksJson = JSON.stringify(data.tracks || []);
        const contentsJson = JSON.stringify(contentsWithImages);
        const snsJson = JSON.stringify(data.sns || {});

        const query = `
            INSERT INTO ${TABLE_NAME} (id, name, type, tracks, contents, sns)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                name=VALUES(name), type=VALUES(type), tracks=VALUES(tracks), 
                contents=VALUES(contents), sns=VALUES(sns)
        `;
        
        await pool.execute<ResultSetHeader>(query, [
            data.id, data.name, data.type, tracksJson, contentsJson, snsJson
        ]);

        // 4. 성공 응답 반환
        res.status(200).json({ success: true, data: { ...data, contents: contentsWithImages } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: `Failed to save member: ${getErrorMessage(err)}` });
    }
});

// GET 및 DELETE 라우트는 기존 profileController/profileService를 통해 처리됩니다.

export default router;
