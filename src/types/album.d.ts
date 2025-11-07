export interface AlbumItem {
  id: string;
  title: string;
  date: string;
  image: string;
  description?: string;
  tracks?: string[];
  videoUrl?: string;
  createdAt?: string; 
  updatedAt?: string;
}