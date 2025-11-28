// server/src/routes.ts
import { Router, type Request } from "express";
import { get, all, run, one, query, exec } from "./db.js";
import type { UserRow } from "./types.js";
import {
  exchangeCodeForToken,
  fetchTossMe,
  decryptTossUser,
} from "./toss.js";
import axios from "axios";

const router = Router();

// 광고 보상/추천인 중복 방지용 간단한 메모리 캐시
const usedRewardKeys = new Set<string>();
const lastRewardAt = new Map<number, number>();
const REWARD_COOLDOWN_MS = 30 * 1000;

// Admin token for scheduler-triggered tasks
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const PRIZE_THRESHOLD = 1000;
const PRIZE_MAX = 50000;
const PAYOUT_SIMULATE = process.env.PAYOUT_SIMULATE === "1";
const PROMO_CODE = process.env.TOSS_PROMOTION_CODE || "";
const PROMO_ACCESS_TOKEN = process.env.TOSS_PROMOTION_ACCESS_TOKEN || "";
const APPS_IN_TOSS_API = "https://apps-in-toss-api.toss.im";

// 22:00 KST 기준 일자 계산
function getKstWindowStart(now = new Date()) {
  const offsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + offsetMs);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  const h = kstNow.getUTCHours();

  // window starts at 22:00 KST (13:00 UTC)
  const startKstUtc = new Date(Date.UTC(y, m, d, 22, 0, 0));
  const startUtcMs = startKstUtc.getTime() - offsetMs;

  if (h >= 22) {
    return new Date(startUtcMs);
  } else {
    const prevStart = new Date(startUtcMs - 24 * 60 * 60 * 1000);
    return prevStart;
  }
}

function getNextReset(now = new Date()) {
  const start = getKstWindowStart(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

// 토스 포인트 지급 (실제 엔드포인트 정보 필요)
async function sendTossPoints(userId: number, points: number) {
  if (PAYOUT_SIMULATE) {
    console.log(`[SIMULATE] would send ${points}P to user ${userId}`);
    return { ok: true };
  }

  if (!PROMO_CODE || !PROMO_ACCESS_TOKEN) {
    throw new Error("PROMO_ENV_MISSING");
  }

  // 유저 toss_user_key 조회
  const u = await one<{ toss_user_key: string | null }>(
    `SELECT toss_user_key FROM users WHERE id = $1`,
    [userId]
  );
  if (!u?.toss_user_key) throw new Error("NO_TOSS_USER_KEY");

  // 1) 지급 키 생성
  const keyResp = await axios.post(
    `${APPS_IN_TOSS_API}/api-partner/v1/apps-in-toss/promotion/execute-promotion/get-key`,
    {},
    {
      headers: {
        Authorization: `Bearer ${PROMO_ACCESS_TOKEN}`,
      },
      timeout: 10000,
    }
  );
  const key = (keyResp.data as any)?.key;
  if (!key) throw new Error("GET_KEY_FAILED");

  // 2) 포인트 지급
  const execResp = await axios.post(
    `${APPS_IN_TOSS_API}/api-partner/v1/apps-in-toss/promotion/execute-promotion`,
    {
      promotionCode: PROMO_CODE,
      key,
      amount: points,
    },
    {
      headers: {
        Authorization: `Bearer ${PROMO_ACCESS_TOKEN}`,
        "x-toss-user-key": u.toss_user_key,
      },
      timeout: 10000,
    }
  );

  return execResp.data;
}

// ------------------------------
// DEV 모드 설정
// ------------------------------
// 로컬 개발 환경에서 로그인 없이도 게임 테스트 가능하도록 fallback 허용
// 운영(Cloud Run) 배포 시에는 USE_DEV_FALLBACK=0 을 넣으면 됨.
const USE_DEV_FALLBACK = process.env.USE_DEV_FALLBACK !== "0";

/** ---------------------------------------------
 * 공통: 현재 로그인한 유저 가져오기
 * ---------------------------------------------
 * 1) 쿠키(uid) 가 있으면 해당 유저를 반환
 * 2) 쿠키가 없고 dev fallback 허용이면 → 가장 최근 유저
 * 3) dev fallback에서도 유저가 없다면 → 게스트 유저 생성 후 반환
 */
async function getCurrentUser(req: Request): Promise<UserRow> {
  const uid = (req as any).cookies?.uid;

  // 1) 쿠키 기반 유저
  if (uid) {
    const u = await one<UserRow>(`SELECT * FROM users WHERE id = $1`, [uid]);
    if (u) return u;
  }

  // 2) dev fallback
  if (!USE_DEV_FALLBACK) throw new Error("NO_LOGIN");

  let user = await one<UserRow>(
    `SELECT * FROM users ORDER BY id DESC LIMIT 1`
  );

  if (!user) {
    // user가 하나도 없으면 기본 유저 생성
    await exec(
      `INSERT INTO users (nickname, toss_user_key, best_prob, coins, referral_points)
       VALUES ('게스트', NULL, NULL, 40, 0)`
    );
    user = await one<UserRow>(
      `SELECT * FROM users ORDER BY id DESC LIMIT 1`
    );
  }

  return user!;
}

// ============================================================
// 0) 토스 로그인 엔드포인트
// ============================================================
router.post("/auth/toss-login", async (req, res) => {
  try {
    const { authorizationCode, referrer } = req.body as {
      authorizationCode?: string;
      referrer?: string | null;
    };

    if (!authorizationCode) {
      return res
        .status(400)
        .json({ error: "NO_CODE", message: "authorizationCode가 필요합니다." });
    }

    // 1) Authorization Code -> Access Token
    const tokenResp = await exchangeCodeForToken(authorizationCode);
    const accessToken =
      (tokenResp as any).accessToken ||
      (tokenResp as any).access_token;

    if (!accessToken) {
      return res.status(500).json({
        error: "NO_ACCESS_TOKEN",
        message: "토스 accessToken 획득 실패",
      });
    }

    // 2) /me 호출 → 암호화 payload 획득
    const encrypted = await fetchTossMe(accessToken);

    // 3) 복호화 → tossUserKey 획득
    const dec = await decryptTossUser(encrypted);
    const tossUserKey = dec.tossUserKey;

    // 4) DB에서 찾기
    let user = await get<UserRow>(
      `SELECT * FROM users WHERE toss_user_key = ?`,
      [tossUserKey]
    );

    // 5) 없으면 신규 생성
    if (!user) {
      await run(
        `INSERT INTO users (nickname, toss_user_key, best_prob, coins, referral_points)
         VALUES (NULL, ?, NULL, 40, 0)`,
        [tossUserKey]
      );
      user = await get<UserRow>(
        `SELECT * FROM users WHERE toss_user_key = ?`,
        [tossUserKey]
      );
    }

    // 6) 쿠키 발급
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("uid", String(user!.id), {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30일
    });

    // 7) 응답
    return res.json({
      ok: true,
      hasNickname: Boolean(user!.nickname),
      nickname: user!.nickname,
    });
  } catch (e: any) {
    console.error("toss-login error:", e);
    return res.status(500).json({
      error: "TOSS_LOGIN_FAIL",
      message: e?.message || String(e),
    });
  }
});

// ============================================================
// 1) 내 정보 조회
// ============================================================
router.get("/me", async (req, res) => {
  try {
    const u = await getCurrentUser(req);
    return res.json({
      nickname: u.nickname,
      best_score: u.best_prob,
      coins: u.coins ?? 0,
    });
  } catch (e: any) {
    if (e.message === "NO_LOGIN") {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 2) 지갑 조회
// ============================================================
router.get("/wallet", async (req, res) => {
  try {
    const u = await getCurrentUser(req);
    return res.json({ coins: u.coins ?? 0 });
  } catch (e: any) {
    if (e.message === "NO_LOGIN") {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 3) 닉네임 설정
// ============================================================
router.post("/auth/nickname", async (req, res) => {
  const { nickname } = req.body as { nickname?: string };

  const trimmed = nickname?.trim();
  if (!trimmed) {
    return res
      .status(400)
      .json({ error: "BAD_NICK", message: "닉네임을 입력해 주세요." });
  }

  // 중복 체크
  const exists = await get<{ id: number }>(
    `SELECT id FROM users WHERE nickname = ?`,
    [trimmed]
  );
  if (exists) {
    return res
      .status(409)
      .json({ error: "DUPLICATE_NICKNAME", message: "이미 사용 중인 닉네임입니다." });
  }

  const uid = (req as any).cookies?.uid;

  if (uid) {
    // 로그인한 유저 → nickname 업데이트
    await run(
      `UPDATE users SET nickname = ? WHERE id = ?`,
      [trimmed, uid]
    );
    const user = await get<UserRow>(
      `SELECT * FROM users WHERE id = ?`,
      [uid]
    );
    return res.json({
      user: {
        id: user!.id,
        nickname: user!.nickname!,
        best_score: user!.best_prob,
      },
    });
  }

  // dev fallback → 새 유저 생성
  await run(
    `INSERT INTO users (nickname, toss_user_key, best_prob, coins, referral_points)
     VALUES (?, NULL, NULL, 40, 0)`,
    [trimmed]
  );

  const user = await get<UserRow>(
    `SELECT * FROM users WHERE nickname = ?
     ORDER BY id DESC LIMIT 1`,
    [trimmed]
  );

  return res.json({
    user: {
      id: user!.id,
      nickname: user!.nickname!,
      best_score: user!.best_prob,
    },
  });
});

// ============================================================
// 4) 플레이 (코인 소모 + 누적 확률 갱신)
// ============================================================
router.post("/play", async (req, res) => {
  const { chosen, current } = req.body as {
    chosen: number;
    current: number;
  };

  try {
    const u = await getCurrentUser(req);

    if (!u.coins || u.coins <= 0) {
      return res.status(400).json({
        error: "NO_COINS",
        message: "코인이 부족합니다.",
      });
    }

    const success = Math.random() < chosen;
    let newCurrent = success ? current * chosen : 1.0;

    let newBest = u.best_prob ?? 1.0;
    if (success && newCurrent < newBest) newBest = newCurrent;

    await run(
      `UPDATE users SET coins = coins - 1, best_prob = ? WHERE id = ?`,
      [newBest, u.id]
    );

    await run(
      `INSERT INTO plays (user_id, success_count, trial_count, prob)
       VALUES (?, ?, ?, ?)`,
      [u.id, success ? 1 : 0, 1, newCurrent]
    );

    const rankRow = await get<{ rank: number }>(
      `SELECT COUNT(*) + 1 AS rank
       FROM users
       WHERE best_prob IS NOT NULL AND best_prob < ?`,
      [newBest]
    );

    return res.json({
      result: success ? "success" : "fail",
      current_score: newCurrent,
      best_score: newBest,
      rank: rankRow?.rank ?? null,
    });
  } catch (e: any) {
    if (e.message === "NO_LOGIN") {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 5) 광고 보상
// ============================================================
router.post("/reward-ad", async (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "BAD_KEY" });
  }

  try {
    const u = await getCurrentUser(req);
    const now = Date.now();

    // 유저별 쿨다운
    const last = lastRewardAt.get(u.id) ?? 0;
    if (now - last < REWARD_COOLDOWN_MS) {
      const retryAfter = Math.ceil((REWARD_COOLDOWN_MS - (now - last)) / 1000);
      return res.status(429).json({ error: "COOLDOWN", retryAfter });
    }

    // 키 중복 방지
    if (usedRewardKeys.has(key)) {
      return res.status(409).json({ error: "DUP_KEY" });
    }

    usedRewardKeys.add(key);
    lastRewardAt.set(u.id, now);

    await run(`UPDATE users SET coins = coins + 20 WHERE id = ?`, [u.id]);
    return res.json({ ok: true, coins: (u.coins ?? 0) + 20 });
  } catch (e: any) {
    if (e.message === "NO_LOGIN") {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 6) 추천인 보상
// ============================================================
router.post("/referral/claim", async (req, res) => {
  const { ref } = req.body as { ref?: string };

  if (!ref) return res.status(400).json({ error: "NO_REF" });

  try {
    const u = await getCurrentUser(req);
    const refId = Number(ref);

    if (!Number.isInteger(refId)) {
      return res.status(400).json({ error: "BAD_REF" });
    }
    if (u.id === refId) {
      return res.status(400).json({ error: "SELF_REF" });
    }

    const exists = await get<{ id: number }>(
      `SELECT id FROM users WHERE id = ?`,
      [refId]
    );
    if (!exists)
      return res.status(404).json({ error: "REF_NOT_FOUND" });

    // claimer가 이미 보상 받았는지 확인 (한 번만 허용)
    const already = await get<{ id: number }>(
      `SELECT id FROM referral_claims WHERE claimer_id = ?`,
      [u.id]
    );
    if (already) {
      return res.status(409).json({ error: "ALREADY_CLAIMED" });
    }

    // 트랜잭션은 없지만 순차 실행으로 최소한의 일관성 확보
    await run(
      `INSERT INTO referral_claims (claimer_id, referrer_id) VALUES (?, ?)`,
      [u.id, refId]
    );

    // 추천인/신규 모두 코인 +20, 추천 포인트 +1
    await run(
      `UPDATE users
       SET referral_points = COALESCE(referral_points, 0) + 1,
           coins = COALESCE(coins, 0) + 30
       WHERE id = ?`,
      [refId]
    );

    return res.json({ ok: true });
  } catch (e: any) {
    if (e.message === "NO_LOGIN") {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 7) 랭킹 Top100 (+내 순위)
// ============================================================
router.get("/ranking", async (req, res) => {
  const rows = await all<{
    nickname: string;
    bestProb: number | null;
  }>(
    `SELECT nickname, best_prob AS bestProb
     FROM users
     WHERE nickname IS NOT NULL AND best_prob IS NOT NULL
     ORDER BY best_prob ASC
     LIMIT 100`
  );

  // 내 순위 계산 (로그인 안 되어 있으면 null)
  let me: { nickname: string | null; best_score: number | null; rank: number | null } | null = null;
  try {
    const u = await getCurrentUser(req);
    if (u.best_prob != null) {
      const myRank = await get<{ rank: number }>(
        `SELECT COUNT(*) + 1 AS rank
         FROM users
         WHERE best_prob IS NOT NULL AND best_prob < ?`,
        [u.best_prob]
      );
      me = {
        nickname: u.nickname,
        best_score: u.best_prob,
        rank: myRank?.rank ?? null,
      };
    } else {
      me = {
        nickname: u.nickname,
        best_score: null,
        rank: null,
      };
    }
  } catch (e: any) {
    if (e?.message !== "NO_LOGIN") {
      console.warn("ranking me fetch error:", e);
    }
  }

  // 이벤트 정보: 현재 윈도우 참여자/풀/다음 리셋
  const windowStart = getKstWindowStart(new Date());
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  const participantsRow = await get<{ cnt: number }>(
    `SELECT COUNT(DISTINCT user_id) AS cnt
     FROM plays
     WHERE created_at >= ? AND created_at < ?`,
    [windowStart.toISOString(), windowEnd.toISOString()]
  );
  const participants = participantsRow?.cnt ?? 0;
  const prizePool = participants >= PRIZE_THRESHOLD
    ? Math.min(participants, PRIZE_MAX)
    : 0;

  // 어제(마지막) 우승자 정보
  const lastRun = await get<{
    date: string;
    prize_pool: number;
    winner_user_id: number | null;
    winner_best_prob: number | null;
  }>(
    `SELECT date, prize_pool, winner_user_id, winner_best_prob
     FROM daily_runs
     ORDER BY date DESC
     LIMIT 1`
  );
  let lastWinner: { date: string; prizePool: number; nickname: string | null; best: number | null } | null = null;
  if (lastRun) {
    let nick: string | null = null;
    if (lastRun.winner_user_id) {
      const u = await get<{ nickname: string | null }>(
        `SELECT nickname FROM users WHERE id = ?`,
        [lastRun.winner_user_id]
      );
      nick = u?.nickname ?? null;
    }
    lastWinner = {
      date: lastRun.date,
      prizePool: lastRun.prize_pool,
      nickname: nick,
      best: lastRun.winner_best_prob ?? null,
    };
  }

  return res.json({
    ok: true,
    rows,
    me,
    event: {
      participants,
      prizePool,
      threshold: PRIZE_THRESHOLD,
      maxPrize: PRIZE_MAX,
      nextReset: getNextReset(new Date()).toISOString(),
      lastWinner,
      payoutSimulate: PAYOUT_SIMULATE,
    },
  });
});

// ============================================================
// 8) 일일 집계/리셋 (Scheduler용)
// ============================================================
router.post("/admin/daily-close", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "NO_AUTH" });
  }

  const now = new Date();
  const windowStart = getKstWindowStart(now);
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  const offsetMs = 9 * 60 * 60 * 1000;
  const labelDate = new Date(windowStart.getTime() + offsetMs)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

  try {
    // 이미 처리된 날짜면 중복 방지
    const exists = await get<{ id: number }>(
      `SELECT id FROM daily_runs WHERE date = ?`,
      [labelDate]
    );
    if (exists) {
      return res.status(409).json({ error: "ALREADY_DONE", date: labelDate });
    }

    // 참여자/스코어 집계
    const participantsRow = await get<{ cnt: number }>(
      `SELECT COUNT(DISTINCT user_id) AS cnt
       FROM plays
       WHERE created_at >= ? AND created_at < ?`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );
    const participants = participantsRow?.cnt ?? 0;

    const topRows = await all<{ user_id: number; best_prob: number }>(
      `SELECT user_id, MIN(prob) AS best_prob
       FROM plays
       WHERE created_at >= ? AND created_at < ?
       GROUP BY user_id
       ORDER BY best_prob ASC
       LIMIT 100`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    // daily_scores 기록 (Top 100)
    let rank = 1;
    for (const r of topRows) {
      await run(
        `INSERT INTO daily_scores (date, user_id, best_prob, rank)
         VALUES (?, ?, ?, ?)`,
        [labelDate, r.user_id, r.best_prob, rank]
      );
      rank += 1;
    }

    // 상금 풀 계산
    const prizePool = participants >= PRIZE_THRESHOLD
      ? Math.min(participants, PRIZE_MAX)
      : 0;
    const winner = topRows[0];

    const payoutStatus = prizePool > 0 && winner ? "PENDING" : "SKIPPED";
    const winnerId = prizePool > 0 && winner ? winner.user_id : null;
    const winnerBest = prizePool > 0 && winner ? winner.best_prob : null;

    await run(
      `INSERT INTO daily_runs
       (date, participants, prize_pool, winner_user_id, winner_best_prob, payout_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [labelDate, participants, prizePool, winnerId, winnerBest, payoutStatus]
    );

    if (prizePool > 0 && winner) {
      await run(
        `INSERT INTO payout_logs (date, user_id, points, status)
         VALUES (?, ?, ?, ?)`,
        [labelDate, winner.user_id, prizePool, "PENDING"]
      );
    }

    // 오늘 시작을 위해 best_prob 초기화
    await run(`UPDATE users SET best_prob = NULL`);
    // 코인 40 미만이면 40으로 보충 (초과분은 유지)
    await run(`UPDATE users SET coins = 40 WHERE coins < 40 OR coins IS NULL`);

    // 보관 기간 관리: 30일 이전 daily_scores/payout_logs 삭제
    await run(
      `DELETE FROM daily_scores
       WHERE date < date('now', '-30 day')`
    );
    await run(
      `DELETE FROM payout_logs
       WHERE date < date('now', '-30 day')`
    );

    return res.json({
      ok: true,
      date: labelDate,
      participants,
      prizePool,
      winnerId,
      winnerBest,
    });
  } catch (e: any) {
    console.error("daily-close error:", e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

// ============================================================
// 9) 포인트 지급 처리 (수동/스케줄러)
// ============================================================
router.post("/admin/process-payouts", async (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "NO_AUTH" });
  }
  try {
    const pending = await all<{
      id: number;
      user_id: number;
      points: number;
    }>(
      `SELECT id, user_id, points
       FROM payout_logs
       WHERE status = 'PENDING'`
    );

    const results: any[] = [];
    for (const p of pending) {
      try {
        const resp = await sendTossPoints(p.user_id, p.points);
        await run(
          `UPDATE payout_logs
           SET status = 'SENT',
               response_payload = ?
           WHERE id = ?`,
          [JSON.stringify(resp), p.id]
        );
        results.push({ id: p.id, status: "SENT" });
      } catch (err: any) {
        await run(
          `UPDATE payout_logs
           SET status = 'FAILED',
               response_payload = ?
           WHERE id = ?`,
          [JSON.stringify({ message: err?.message || String(err) }), p.id]
        );
        results.push({ id: p.id, status: "FAILED", message: err?.message });
      }
    }

    return res.json({ ok: true, processed: results });
  } catch (e: any) {
    console.error("process-payouts error:", e);
    return res.status(500).json({ error: "INTERNAL", message: e?.message });
  }
});

export default router;
