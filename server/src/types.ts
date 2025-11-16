// 서버에서 공통으로 쓰는 타입들 모음

// users 테이블 1행
export type UserRow = {
  id: number;
  nickname: string | null;
  toss_user_key: string | null;
  best_prob: number | null;      // 가장 낮은(희박한) 성공 확률
  coins: number | null;          // 보유 코인
  referral_points: number | null;// 추천 포인트 (없으면 null)
  created_at: string;
};

// 토스 암호화 필드 1개 (AES-GCM)
export interface EncryptedField {
  iv: string;   // base64
  aad: string;  // base64
  data: string; // base64
  tag: string;  // base64
}

// 토스 /me 응답에서 암호화된 전체 payload
export interface TossEncryptedPayload {
  userKey: EncryptedField;
  phone?: EncryptedField;
  name?: EncryptedField;
}
