import { 
    S3Client, 
    PutObjectCommand, 
    DeleteObjectCommand,
    ObjectCannedACL // ACL 타입 임포트
} from '@aws-sdk/client-s3'; 
import dotenv from 'dotenv';

dotenv.config();

// ----------------------------------------------------
// 1. S3 클라이언트 및 버킷 설정
// ----------------------------------------------------

const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'your-s3-bucket-name';

// S3Client 초기화
const s3 = new S3Client({
    region: AWS_REGION,
});


// ----------------------------------------------------
// 2. 버퍼(Buffer)를 S3에 직접 업로드하는 함수
// ----------------------------------------------------

/**
 * 메모리 버퍼를 S3에 직접 업로드하고 공개 URL을 반환합니다.
 * @param buffer 파일 버퍼
 * @param key S3에 저장할 최종 경로/이름 (예: 'gallery/uuid.png')
 * @param contentType 파일 타입
 * @returns 파일의 공개 URL
 */
export async function uploadBufferToStorage(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    const uploadParams = {
        Bucket: AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    };

    try {
        await s3.send(new PutObjectCommand(uploadParams)); 
        
        return `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    } catch (error) {
        console.error("S3 Buffer Upload Failed:", error);
        throw new Error("Failed to upload file to S3.");
    }
}


// ----------------------------------------------------
// 3. S3 파일 삭제 함수
// ----------------------------------------------------

/**
 * S3 버킷에서 지정된 키(Key)의 파일을 삭제합니다.
 * @param key S3에 저장된 파일의 키 (예: 'gallery/uuid.png')
 */
export async function deleteFromStorage(key: string): Promise<void> {
    const deleteParams = {
        Bucket: AWS_S3_BUCKET_NAME,
        Key: key,
    };

    try {
        await s3.send(new DeleteObjectCommand(deleteParams));
        console.log(`Successfully deleted object: ${key}`);
    } catch (error) {
        console.error(`S3 Delete Failed for key ${key}:`, error);
        throw new Error(`Failed to delete file from S3: ${key}`);
    }
}