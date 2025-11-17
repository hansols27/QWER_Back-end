import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mainRouter from "./routes/index"; // 중앙 라우터 임포트

// ⭐️ 환경 변수 로딩: NODE_ENV가 production이 아닐 때만 .env 로드
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const app = express();

// CORS 허용 도메인을 환경변수에서 가져와 배열로 준비
const allowedOrigins = (process.env.CORS_ORIGINS || "")
                        .split(",")
                        .map(origin => origin.trim())
                        .filter(origin => origin.length > 0); // 빈 문자열 제거

app.use(cors({
    origin: (origin, callback) => {
        // origin이 없거나 (같은 서버에서 오는 요청, 예: curl) allowedOrigins에 포함되어 있으면 허용
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // 허용되지 않은 출처는 CORS 오류 발생
            callback(new Error(`Not allowed by CORS: ${origin}`), false);
        }
    },
    credentials: true,
}));

// JSON 바디 파싱
app.use(express.json());

// ⭐ 모든 API 요청을 '/api'로 묶고, 상세 경로는 index.ts 라우터에 위임
app.use("/api", mainRouter);

// 루트 경로 처리 (서버 상태 확인용)
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({ message: "Welcome to QwerFansite API!", version: "1.0.0" });
});

// 헬스 체크 엔드포인트
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "OK" });
});

// 404 에러 처리 (모든 요청 처리 후 남은 요청에 대해)
app.use((req: Request, res: Response, next: NextFunction) => {
    // 404 에러를 발생시켜 다음 에러 핸들러로 전달
    const error = new Error(`${req.method} ${req.originalUrl} Not Found`);
    (error as any).status = 404;
    next(error);
});

// 에러 핸들링 미들웨어
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    // CORS 오류 메시지를 좀 더 명확하게 클라이언트에 전달
    if (err.message.startsWith('Not allowed by CORS')) {
        return res.status(403).json({ message: "CORS Blocked", detail: err.message });
    }
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

export default app;