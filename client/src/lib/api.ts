// ============================
// API BASE URL
// ============================
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://rank-my-luck-545641744682.us-central1.run.app";

// ============================
// 공통 request
// ============================
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let msg: any = await res.text();
    try {
      msg = JSON.parse(msg);
    } catch {}
    throw new Error(msg?.message || `API_ERROR ${res.status}`);
  }

  return res.json();
}

// ============================
// HTTP wrapper
// ============================
export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: any) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ============================
// 1) 내 정보 조회
// ============================
export function me() {
  return api.get<{
    nickname: string | null;
    best_score: number | null;
    coins: number;
  }>("/api/me");
}

// ============================
// 2) 플레이 (코인 차감 + 확률 계산)
// ============================
export function play(chosen: number, current: number) {
  return api.post<{
    result: "success" | "fail";
    current_score: number;
    best_score: number;
    rank: number | null;
    error?: string;
  }>("/api/play", { chosen, current });
}

// ============================
// 3) 광고 보상 (코인 +20)
// ============================
export function rewardAd(key: string) {
  return api.post<{ ok: boolean }>("/api/reward-ad", { key });
}

// ============================
// 4) 닉네임 설정
// ============================
export async function setNicknameApi(nick: string): Promise<NicknameResponse> {
  return request<NicknameResponse>("/api/auth/nickname", {
    method: "POST",
    body: JSON.stringify({ nickname: nick }),
  });
}


// ============================
// 5) 추천인 보상 (referral)
// ============================
export function claimReferral(code: string) {
  return api.post("/api/referral/claim", { code });
}

// ============================
// 6) 랭킹
// ============================
export function fetchRanking() {
  return api.get<{ rows: { nickname: string; bestProb: number | null }[] }>(
    "/api/ranking"
  );
}

// ============================
// 7) 지갑(코인)
// ============================
export function wallet() {
  return api.get<{ coins: number }>("/api/wallet");
}


// 닉네임 API 응답 타입
export type NicknameResponse =
  | { user: { id: number; nickname: string; best_score: number | null } }
  | { error: "DUPLICATE_NICKNAME"; message: string };
