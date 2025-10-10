export type NoticeType = "공지" | "이벤트";

export interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}
