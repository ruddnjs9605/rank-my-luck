let TOKEN: string | null = localStorage.getItem("token");
export function setToken(t: string) {
  TOKEN = t;
  localStorage.setItem("token", t);
}
function authHeader() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

/** 기존 로그인/유저 API들… */
export async function devLogin(userId: string) {
  const r = await fetch(`/auth/toss/callback?user_id=${encodeURIComponent(userId)}`);
  return r.json(); // { token }
}
export async function me() {
  const r = await fetch("/api/me", { headers: authHeader() });
  return r.json(); // { user_id, nickname, best_score, coins, ... }
}
export async function setNicknameApi(nick: string) {
  const r = await fetch("/api/nickname", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ nickname: nick }),
  });
  return r.json();
}

/** 플레이 */
export async function play(chosen_prob: number, prev_score: number) {
  const r = await fetch("/api/play", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ chosen_prob, prev_score }),
  });
  const data = await r.json();
  // 402 등 에러도 그대로 data.error로 전달
  return data;
}

/** 리더보드 */
export async function leaderboard() {
  const r = await fetch("/api/leaderboard", { headers: authHeader() });
  return r.json(); // { top, me }
}

/** 코인/보상 */
export async function wallet() {
  const r = await fetch("/api/wallet", { headers: authHeader() });
  return r.json(); // { coins }
}
export async function rewardAd(idempotencyKey: string) {
  const r = await fetch("/api/ads/reward", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ idempotencyKey }),
  });
  return r.json(); // { ok, delta } | { error }
}
export async function claimReferral(referrer_user_id: string) {
  const r = await fetch("/api/referral/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ referrer_user_id }),
  });
  return r.json(); // { ok } | { error }
}
