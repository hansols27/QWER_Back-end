export interface SnsLink {
  id: "instagram" | "youtube" | "twitter" | "cafe" | "shop";
  url: string;
  icon?: string; 
}

export interface SettingsData {
  mainImage?: string; // 메인 이미지 URL
  snsLinks: SnsLink[];
}
