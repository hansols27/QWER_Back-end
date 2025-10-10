import { db, bucket } from "../firebaseConfig";
import type { SettingsData, SnsLink } from "@/types/settings";

const DEFAULT_SNS_IDS: SnsLink["id"][] = ["instagram", "youtube", "twitter", "cafe", "shop"];

/**
 * 설정 조회
 */
export const getSettings = async (): Promise<SettingsData> => {
  const docRef = db.doc("settings/main");
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    // 문서 없으면 기본값 반환
    return {
      mainImage: "",
      snsLinks: DEFAULT_SNS_IDS.map(id => ({ id, url: "" })),
    };
  }

  const stored = docSnap.data() as SettingsData;

  return {
    mainImage: stored.mainImage || "",
    snsLinks: DEFAULT_SNS_IDS.map(
      id => stored.snsLinks.find(link => link.id === id) || { id, url: "" }
    ),
  };
};

/**
 * 설정 저장
 */
export const saveSettings = async (
  snsLinks: SnsLink[],
  file?: Express.Multer.File
): Promise<SettingsData> => {
  // SNS 링크 기본값 보장
  const finalSnsLinks: SnsLink[] = DEFAULT_SNS_IDS.map(
    id => snsLinks.find(l => l.id === id) || { id, url: "" }
  );

  let mainImage = "";
  const docRef = db.doc("settings/main");

  if (file) {
    // 메인 이미지 업로드 (덮어쓰기)
    const storageFile = bucket.file("images/main.png");
    await storageFile.save(file.buffer, { contentType: file.mimetype, resumable: false });
    await storageFile.makePublic();
    mainImage = storageFile.publicUrl();
  } else {
    // 기존 이미지 유지
    const docSnap = await docRef.get();
    mainImage = docSnap.exists ? ((docSnap.data() as SettingsData).mainImage || "") : "";
  }

  const settingsData: SettingsData = { snsLinks: finalSnsLinks, mainImage };
  await docRef.set(settingsData, { merge: true });

  return settingsData;
};
