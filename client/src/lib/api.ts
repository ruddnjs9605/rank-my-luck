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
    credentials: "include", // 쿠키(uid) 전달
    ...options,
  });

  if (!res.ok) {
    let msg: any = await res.text();
    try {
      msg = JSON.parse(msg);
    } catch {}
    // 401 처리(로그인 필요)
    if (res.status === 401) {
      throw new Error(msg?.message || "로그인이 필요합니다.");
    }
    throw new Error(msg?.message || `API_ERROR ${res.status}`);
  }

  return res.json();
}

// ============================
// HTTP wrapper
// ============================
export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: "GET" }),
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

// 닉네임 API 응답 타입
export type NicknameResponse =
  | { user: { id: number; nickname: string; best_score: number | null } }
  | { error: "DUPLICATE_NICKNAME"; message: string };

// ============================
// 5) 추천인 보상 (referral)
// ============================
export function claimReferral(code: string) {
  return api.post("/api/referral/claim", { ref: code });
}

// ============================
// 6) 랭킹
// ============================
export function fetchRanking() {
  return api.get<{
    rows: { nickname: string; bestProb: number | null }[];
    me: { nickname: string | null; best_score: number | null; rank: number | null } | null;
    event: {
      participants: number;
      prizePool: number;
      threshold: number;
      maxPrize: number;
      nextReset: string;
      lastWinner: { date: string; prizePool: number; nickname: string | null; best: number | null } | null;
    };
  }>("/api/ranking");
}

export function fetchHistoryDates() {
  return api.get<{ dates: string[] }>("/api/history/dates");
}

export function fetchHistoryRanking(date: string) {
  return api.get<{ rows: { rank: number; best_prob: number; nickname: string | null }[] }>(
    `/api/history/${date}/ranking`
  );
}

export function fetchHistoryWinners(date: string) {
  return api.get<{ winners: { user_id: number; nickname: string | null; amount: number; prize: string | null }[] }>(
    `/api/history/${date}/winners`
  );
}

// ============================
// 7) 지갑(코인)
// ============================
export function wallet() {
  return api.get<{ coins: number }>("/api/wallet");
}

// ============================
// 8) 토스 로그인 (authorizationCode 서버로 전달)
// ============================
export type TossLoginResponse =
  | { ok: true; hasNickname: boolean; nickname: string | null }
  | { error: string; message: string };

export function tossLoginEncrypted(
  encryptedUser: any,
  referrer?: string | null
) {
  return api.post<TossLoginResponse>("/api/auth/toss-login", {
    encryptedUser,
    referrer: referrer ?? null,
  });
}
