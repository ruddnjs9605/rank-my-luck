// server/src/routes.ts
import { Router, type Request } from "express";
import { get, all, run } from "./db.js";
import type { UserRow } from "./types.js";
import {
  exchangeCodeForToken,
  fetchTossMe,
  decryptTossUser,
} from "./toss.js";

const router = Router();

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
    const u = await get<UserRow>(`SELECT * FROM users WHERE id = ?`, [uid]);
    if (u) return u;
  }

  // 2) dev fallback
  if (!USE_DEV_FALLBACK) throw new Error("NO_LOGIN");

  let user = await get<UserRow>(
    `SELECT * FROM users ORDER BY id DESC LIMIT 1`
  );

  if (!user) {
    // user가 하나도 없으면 기본 유저 생성
    await run(
      `INSERT INTO users (nickname, toss_user_key, best_prob, coins, referral_points)
       VALUES ('게스트', NULL, NULL, 100, 0)`
    );
    user = await get<UserRow>(
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
         VALUES (NULL, ?, NULL, 100, 0)`,
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
     VALUES (?, NULL, NULL, 100, 0)`,
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
  try {
    const u = await getCurrentUser(req);
    await run(`UPDATE users SET coins = coins + 20 WHERE id = ?`, [u.id]);
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
// 6) 추천인 보상
// ============================================================
router.post("/referral/claim", async (req, res) => {
  const { ref } = req.body as { ref?: string };

  if (!ref) return res.status(400).json({ error: "NO_REF" });

  const exists = await get<{ id: number }>(
    `SELECT id FROM users WHERE id = ?`,
    [ref]
  );
  if (!exists)
    return res.status(404).json({ error: "REF_NOT_FOUND" });

  await run(
    `UPDATE users
     SET referral_points = COALESCE(referral_points, 0) + 1
     WHERE id = ?`,
    [ref]
  );

  return res.json({ ok: true });
});

// ============================================================
// 7) 랭킹 Top100
// ============================================================
router.get("/ranking", async (_req, res) => {
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

  return res.json({ ok: true, rows });
});

export default router;
