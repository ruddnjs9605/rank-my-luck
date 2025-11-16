// src/lib/api.ts
// ============================
// API BASE URL
// ============================
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://rank-my-luck-545641744682.us-central1.run.app";

// ============================
// 공통 request
// ============================
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let msg = await res.text();
    try {
      msg = JSON.parse(msg);
    } catch {}
    throw new Error(msg?.message || `API_ERROR ${res.status}`);
  }

  return res.json();
}

// ============================
// GET / POST 래퍼
// ============================
export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: any) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body)
    })
};

// ============================
// 닉네임 설정
// ============================
export function setNicknameApi(nickname: string) {
  return api.post("/api/auth/nickname", { nickname });
}

// ============================
// 추천인 보상
// ============================
export function claimReferral(code: string) {
  return api.post("/api/referral/claim", { code });
}

// ============================
// 랭킹 조회
// ============================
export function fetchRanking() {
  return api.get("/api/ranking");
}

// ============================
// 점수 저장
// ============================
export function submitScore(best_prob: number) {
  return api.post("/api/score", { best_prob });
}

// ============================
// 지갑/코인 조회 (TopBar에서 사용)
// ============================
export function wallet() {
  return api.get("/api/wallet");
}
