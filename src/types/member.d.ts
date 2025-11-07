/**
 * 텍스트 컨텐츠 항목 타입
 * @property id - UI에서 항목을 추적하고 삭제하기 위한 고유 ID (UUID)
 * @property content - 텍스트 내용
 */
export interface TextItem {
    id: string;
    content: string;
}

/**
 * 이미지 컨텐츠 항목 타입
 * @property id - UI에서 항목을 추적하고 삭제하기 위한 고유 ID (UUID)
 * @property url - 이미지의 URL (또는 Base64 인코딩된 문자열)
 */
export interface ImageItem {
    id: string;
    url: string; 
}

/**
 * SNS 링크 항목 타입 (중복 검사를 위해 배열 요소로 관리)
 * @property id - UI에서 항목을 추적하고 삭제하기 위한 고유 ID (UUID)
 * @property type - SNS 플랫폼 이름 ("instagram", "youtube" 등)
 * @property url - SNS 프로필/채널 URL
 */
export interface SNSLinkItem {
    id: string;
    type: "youtube" | "instagram" | "twitter" | "cafe" | "tiktok" | "weverse" | string;
    url: string;
}

/**
 * ✅ 클라이언트 상태 및 Firestore 데이터 타입
 * - 멤버별 전체 프로필 데이터를 나타냅니다.
 */
export interface MemberProfileState {
    // 고유 키 값 (All, Q, W, E, R)
    id: 'All' | 'Q' | 'W' | 'E' | 'R' | string; 
    // 변하지 않는 값 (QWER, Chodan, Majenta, Hina, Siyeon)
    name: string; 
    // 백엔드 시스템에서 쿼리/저장에 사용될 수 있는 메타데이터
    type: string; 
    
    // 실제 컨텐츠 데이터 (배열 형태로 저장)
    texts: TextItem[];
    images: ImageItem[];
    snslinks: SNSLinkItem[];
}

/**
 * ✅ API 전송용 페이로드 타입 (File ❌, string만 허용)
 * - 클라이언트 상태와 동일한 구조를 가지며, 모든 데이터는 문자열로 구성되어야 합니다.
 */
export type MemberProfilePayload = MemberProfileState;