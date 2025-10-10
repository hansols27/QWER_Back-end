export interface AlbumItem {
  id: string;
  title: string;
  date: string;
  image: string;
  description?: string;
  tracks?: string[];
  videoUrl?: string;
  
  // ⭐️ 백엔드에서 사용하는 경우 추가
  createdAt?: string; 
  updatedAt?: string;
}