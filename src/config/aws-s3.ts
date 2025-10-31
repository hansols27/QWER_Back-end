// AWS SDK v3의 S3Client와 필요한 명령어 임포트
import { S3Client } from '@aws-sdk/client-s3'; 
import dotenv from 'dotenv';

dotenv.config();

// ----------------------------------------------------
// 1. S3 클라이언트 및 버킷 설정
// ----------------------------------------------------

export const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'qwerfansite';

// S3Client 초기화 
// 🚨 credentials를 명시하지 않으면, EC2 인스턴스의 IAM Role을 자동으로 사용합니다.
export const s3 = new S3Client({
  region: AWS_REGION,
  // IAM Role을 사용하지 않고 .env에 ACCESS KEY가 있다면, 아래 설정을 추가하세요.
  /*
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
  */
});