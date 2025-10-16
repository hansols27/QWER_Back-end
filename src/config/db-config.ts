// src/config/db-config.ts

import mysql from 'mysql2/promise';
import dotenv from 'dotenv'; 

// .env 파일에 정의된 환경 변수(DB_HOST, DB_NAME 등)를 로드합니다.
dotenv.config();

// MariaDB 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT), // 포트는 숫자로 변환
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 연결 풀 옵션
  waitForConnections: true, // 연결을 기다릴지 여부
  connectionLimit: 10,      // 최대 연결 수
  queueLimit: 0,
});

// 이 연결 풀 객체를 내보내서 다른 서비스 파일(video.ts 등)에서 사용할 수 있게 합니다.
export default pool;