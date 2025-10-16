// src/utils/aws-s3-upload.ts

import multer from 'multer';
// AWS SDK v3의 S3Client와 필요한 명령어 임포트
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; 
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';
import { Request } from 'express';

dotenv.config();

// ----------------------------------------------------
// 1. S3 클라이언트 및 버킷 설정
// ----------------------------------------------------

const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'your-s3-bucket-name';

// S3Client 초기화 (EC2 IAM Role을 통해 자격 증명 자동 획득)
const s3 = new S3Client({
  region: AWS_REGION,
});

// ----------------------------------------------------
// 2. Multer S3 기반 업로드 미들웨어 (기존 multerMemory 대체)
// ----------------------------------------------------

// 파일 타입 필터 (이미지 파일만 허용)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    // MulterError 대신 Error를 던지거나, 사용자 정의 에러 처리
    cb(new Error('Only image files are allowed!') as any, false);
  }
};

// S3 Storage 설정을 포함한 Multer 인스턴스
export const uploadS3 = multer({
  fileFilter: fileFilter,
  storage: multerS3({
    s3: s3,
    bucket: AWS_S3_BUCKET_NAME,
    acl: 'public-read', // 외부에서 파일 접근 가능하도록 공개 설정
    contentType: multerS3.AUTO_CONTENT_TYPE, // 파일 형식 자동 감지
    key: function (req, file, cb) {
      // S3에 저장될 파일 경로 및 이름 설정 (예: 'posts/timestamp_filename.ext')
      const now = Date.now().toString();
      const filename = file.originalname.replace(/ /g, "_"); // 공백 제거
      cb(null, `uploads/${now}_${filename}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB로 파일 크기 제한 (선택 사항)
  }
});


// ----------------------------------------------------
// 3. 버퍼(Buffer)를 S3에 직접 업로드하는 함수 (기존 uploadBufferToStorage 대체)
// ----------------------------------------------------

/**
 * 메모리 버퍼를 S3에 직접 업로드하고 공개 URL을 반환합니다.
 * @param buffer 파일 버퍼
 * @param destPath S3에 저장할 최종 경로/이름
 * @param contentType 파일 타입 (기본: 'image/png')
 * @returns 파일의 공개 URL
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  destPath: string,
  contentType = 'image/png'
): Promise<string> {
  const uploadParams = {
    Bucket: AWS_S3_BUCKET_NAME,
    Key: destPath,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read' as const, // ACL은 'public-read' | 'private' 등 Literal Type이 필요
  };

  try {
    // S3에 PutObjectCommand 전송하여 업로드
    await s3.send(new PutObjectCommand(uploadParams)); 
    
    // 업로드된 파일의 공개 URL 반환
    return `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${destPath}`;
  } catch (error) {
    console.error("S3 Buffer Upload Failed:", error);
    throw new Error("Failed to upload file to S3.");
  }
}

// ----------------------------------------------------
// 4. 기존 코드와의 호환성을 위한 대체 변수 내보내기
// ----------------------------------------------------

// 기존에 'multerMemory'를 사용했다면, 이 변수를 'uploadS3'로 대체하거나 아래를 사용하세요.
// 단, 메모리 스토리지는 S3 업로드 시 필요하지 않습니다.
export const multerMemory = multer({ storage: multer.memoryStorage() }); // 로컬 테스트용으로 유지 가능