import multer from 'multer';
import { bucket } from '../firebaseConfig';

// 메모리 스토리지로 파일 업로드 받기
export const multerMemory = multer({ storage: multer.memoryStorage() });

// Firebase Storage에 buffer 업로드
export async function uploadBufferToStorage(
  buffer: Buffer,
  destPath: string,
  contentType = 'image/png'
): Promise<string> {
  const file = bucket.file(destPath);
  const stream = file.createWriteStream({ metadata: { contentType } });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', async () => {
      await file.makePublic(); // 공개 URL
      resolve(`https://storage.googleapis.com/${bucket.name}/${file.name}`);
    });
    stream.end(buffer);
  });
}
