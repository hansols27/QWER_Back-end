import type { CSSProperties } from "react";

export interface MemberContentItem {
  type: "text" | "image";
  content: string | string[];
  style?: CSSProperties;
}

export interface MemberSNS {
  youtube?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  weverse?: string;
  cafe?: string;
  [key: string]: string | undefined;
}

export interface Member {
  id: string;
  name: string;
  nameStyle?: React.CSSProperties;
  contents: MemberContentItem[];
  sns?: MemberSNS;
}

// ✅ 프론트에서 사용할 상태 타입 (File 허용)
export type MemberState = {
  text: string[];
  image: (string | File)[];
  sns: MemberSNS;
};

// ✅ API 전송용 타입 (File ❌, string만 허용)
export type MemberPayload = {
  id: string;
  name: string;
  contents: { type: "text" | "image"; content: string }[];
  sns: MemberSNS;
};
