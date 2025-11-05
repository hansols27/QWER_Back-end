import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mainRouter from "./routes/index"; // 중앙 라우터 임포트

dotenv.config();

const app = express();

// CORS 허용 도메인을 환경변수에서 가져오기
const allowedOrigins = (process.env.CORS_ORIGINS || "")
                        .split(",")
                        .map(origin => origin.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// JSON 바디 파싱
app.use(express.json());

// ⭐️ 모든 API 요청을 '/api'로 묶고, 상세 경로는 index.ts 라우터에 위임
app.use("/api", mainRouter);

// 헬스 체크 엔드포인트
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK" });
});

// 에러 핸들링 미들웨어
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

export default app;
