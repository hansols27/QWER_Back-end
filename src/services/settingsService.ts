import pool from '@config/db-config';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { uploadBufferToStorage, deleteFromStorage } from '@utils/aws-s3-upload';
import type { Express } from 'express';
import type { SnsLink, SettingsData } from '@/types/settings'; 

// ----------------------------------------------------
// 1. 타입 정의 및 헬퍼
// ----------------------------------------------------

interface SettingsRow extends RowDataPacket {
  id: number;
  mainImage: string | null;
  snsLinks: string | null; // JSON 문자열
  created_at: Date;
  updated_at: Date;
}

const TABLE_NAME = 'settings';

const extractS3Key = (url: string): string | null => {
  try {
    const urlParts = new URL(url);
    const path = urlParts.pathname.substring(1); 
    return path.startsWith('images/') ? path : null;
  } catch (e) {
    return null;
  }
};

// ----------------------------------------------------
// 2. 서비스 함수
// ----------------------------------------------------

/**
 * 설정 조회 (id = 1 고정)
 */
export async function getSettings(): Promise<SettingsData> {
  const [rows] = await pool.execute<SettingsRow[]>(
    `SELECT id, mainImage, snsLinks FROM ${TABLE_NAME} WHERE id = 1`
  );

  if (rows.length === 0) {
    return { mainImage: '', snsLinks: [] };
  }

  const row = rows[0];

  let snsLinks: SnsLink[] = [];
  if (row.snsLinks) {
    try {
      const parsed = JSON.parse(row.snsLinks);
      if (Array.isArray(parsed)) {
        snsLinks = parsed as SnsLink[];
      }
    } catch (e) {
      console.error('SNS Links JSON parsing error (DB Data):', e);
    }
  }

  return {
    mainImage: row.mainImage || '',
    snsLinks: snsLinks,
  };
}

/**
 * 설정 저장/수정
 */
export async function saveSettings(
  snsLinks: SnsLink[],
  file: Express.Multer.File | undefined
): Promise<SettingsData> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<SettingsRow[]>(
      `SELECT mainImage FROM ${TABLE_NAME} WHERE id = 1 FOR UPDATE`
    );
    
    let currentMainImage: string | null = rows.length > 0 ? rows[0].mainImage : null;
    let newMainImageUrl: string = currentMainImage || '';

    // 2. 새 파일 처리 (mainImage)
    if (file) {
      // 2-1. 기존 이미지가 있다면 S3에서 삭제
      if (currentMainImage) {
        const oldKey = extractS3Key(currentMainImage);
        if (oldKey) {
          await deleteFromStorage(oldKey).catch((err) =>
            console.error('Old S3 deletion failed:', err)
          );
        }
      }

      if (!file.buffer || !file.mimetype) {
        throw new Error('File buffer or mimetype is missing for upload.');
      }

      // 2-2. 새 이미지 S3 업로드
      const mimeTypeExtension = file.mimetype.split('/').pop() || 'png';
      const destPath = `images/main.${mimeTypeExtension}`;

      newMainImageUrl = await uploadBufferToStorage(
        file.buffer,
        destPath,
        file.mimetype
      );
    } 

    // 3. snsLinks 객체 배열을 JSON 문자열로 변환
    const snsLinksJson = JSON.stringify(snsLinks);
    
    // DB에 저장할 mainImage URL (빈 문자열이면 NULL로 변환)
    const dbMainImageUrl = newMainImageUrl.length > 0 ? newMainImageUrl : null;

    // 4. DB에 UPSERT (id=1 고정 사용)
    await conn.execute<ResultSetHeader>(
      // ⭐️ .trim()을 추가하여 SQL 구문 오류를 발생시키는 특수 공백을 제거합니다.
      `
      INSERT INTO ${TABLE_NAME} (id, mainImage, snsLinks) VALUES (1, ?, ?)
      ON DUPLICATE KEY UPDATE
      mainImage = VALUES(mainImage),
      snsLinks = VALUES(snsLinks),
      updated_at = NOW()
      `.trim(),
      [dbMainImageUrl, snsLinksJson]
    );

    await conn.commit();

    return {
      mainImage: newMainImageUrl,
      snsLinks: snsLinks,
    };
  } catch (error) {
    await conn.rollback();
    console.error('saveSettings transaction failed:', error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 메인 이미지 삭제
 */
export async function deleteMainImage(): Promise<boolean> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const currentSettings = await getSettings();
    const imageUrl = currentSettings.mainImage;

    if (!imageUrl) {
      await conn.rollback();
      return false;
    }

    // 2. S3에서 파일 삭제
    const s3Key = extractS3Key(imageUrl);
    if (s3Key) {
      await deleteFromStorage(s3Key).catch((err) =>
        console.error('S3 deletion failed:', err)
      );
    }

    // 3. DB 데이터 업데이트: mainImage 컬럼을 NULL로 업데이트
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE ${TABLE_NAME} SET mainImage = NULL, updated_at = NOW() WHERE id = 1`
    );

    await conn.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await conn.rollback();
    console.error('deleteMainImage transaction failed:', error);
    throw error;
  } finally {
    conn.release();
  }
}