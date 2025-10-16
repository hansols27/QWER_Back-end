import type { CSSProperties } from "react";

export interface MemberContentItem {
    type: "text" | "image";
    content: string | string[];
    style?: CSSProperties;
}

// ⭐️ MemberPayload의 contents를 위한 타입 추가
export interface MemberContentPayloadItem {
    type: "text" | "image";
    content: string; // API 전송 시에는 반드시 string이어야 함
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
    type: string; // MariaDB 쿼리/저장에 사용됨
    nameStyle?: React.CSSProperties;
    contents: MemberContentItem[];
    sns?: MemberSNS;
}

// ✅ 프론트에서 사용할 상태 타입 (File 허용)
export type MemberState = {
    // ⭐️ 누락된 tracks와 type 속성을 추가합니다.
    tracks: string[]; 
    type: string; 
    text: string[];
    image: (string | File)[];
    sns: MemberSNS;
};

// ✅ API 전송용 타입 (File ❌, string만 허용)
export type MemberPayload = {
    id: string;
    name: string;
    type: string;
    tracks: string[]; 
    // ⭐️ contents 속성 타입을 새로 정의한 MemberContentPayloadItem[]으로 변경
    contents: MemberContentPayloadItem[]; 
    sns: MemberSNS;
};
