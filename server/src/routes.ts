import { Router } from "express";
import { get, all, run } from "./db.js";

const router = Router();

// DB에서 user 한 명 타입 (내부에서만 사용)
type DbUser = {
  id: number;
  nickname: string | null;
  best_prob: number | null;
  coins: number | null;
};

// 쿠키에 저장된 nickname 으로 유저 찾기 (없으면 null)
async function findUserByCookie(req: any): Promise<DbUser | null> {
  const nickname = req.cookies?.nickname as string | undefined;
  if (!nickname) return null;

  const user = await get<DbUser>(
    `SELECT id, nickname, best_prob, coins
     FROM users
     WHERE nickname = ?`,
    [nickname]
  );
  return user ?? null;
}

/** 닉네임 설정 (중복 체크 + 쿠키 설정) */
router.post("/auth/nickname", async (req: any, res: any) => {
  const { nickname } = req.body as { nickname?: string };

  if (!nickname || typeof nickname !== "string") {
    return res
      .status(400)
      .json({ error: "BAD_REQUEST", message: "닉네임이 필요합니다." });
  }

  const exists = await get<DbUser>(
    `SELECT id, nickname, best_prob, coins
     FROM users
     WHERE nickname = ?`,
    [nickname]
  );

  if (exists) {
    return res.json({
      error: "DUPLICATE_NICKNAME",
      message: "이미 사용중인 닉네임입니다.",
    });
  }

  await run(
    `INSERT INTO users (nickname, best_prob, coins)
     VALUES (?, NULL, 100)`,
    [nickname]
  );

  const user = await get<{
    id: number;
    nickname: string;
    best_score: number | null;
  }>(
    `SELECT id, nickname, best_prob AS best_score
     FROM users
     WHERE nickname = ?`,
    [nickname]
  );

  res.cookie("nickname", nickname, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  return res.json({ user });
});

/** 추천인(referral) 보상 */
router.post("/referral/claim", async (req: any, res: any) => {
  const { ref, code } = req.body as { ref?: string; code?: string };
  const target = ref ?? code;

  if (!target) {
    return res
      .status(400)
      .json({ error: "NO_REF", message: "추천인 코드가 없습니다." });
  }

  const exists = await get<{ id: number }>(
    `SELECT id FROM users WHERE id = ?`,
    [target]
  );

  if (!exists) {
    return res
      .status(404)
      .json({ error: "REF_NOT_FOUND", message: "추천인을 찾을 수 없습니다." });
  }

  await run(
    `UPDATE users
     SET referral_points = COALESCE(referral_points, 0) + 1
     WHERE id = ?`,
    [target]
  );

  return res.json({ ok: true });
});

/** 내 정보 조회 */
router.get("/me", async (req: any, res: any) => {
  const user = await findUserByCookie(req);

  if (!user) {
    return res.json({
      nickname: null,
      best_score: null,
      coins: 0,
    });
  }

  return res.json({
    nickname: user.nickname,
    best_score: user.best_prob,
    coins: user.coins ?? 0,
  });
});

/** 지갑(코인) 조회 */
router.get("/wallet", async (req: any, res: any) => {
  const user = await findUserByCookie(req);
  if (!user) return res.json({ coins: 0 });
  return res.json({ coins: user.coins ?? 0 });
});

/** 플레이 */
router.post("/play", async (req: any, res: any) => {
  const user = await findUserByCookie(req);
  if (!user) {
    return res
      .status(401)
      .json({ error: "NO_AUTH", message: "로그인이 필요합니다." });
  }

  const { chosen, current } = req.body;

  if (
    typeof chosen !== "number" ||
    typeof current !== "number" ||
    chosen <= 0 ||
    chosen >= 1
  ) {
    return res.json({ error: "BAD_REQUEST" });
  }

  const coins = user.coins ?? 0;
  if (coins <= 0) return res.json({ error: "NO_COINS" });

  await run(`UPDATE users SET coins = coins - 1 WHERE id = ?`, [user.id]);

  const isSuccess = Math.random() < chosen;
  let result: "success" | "fail";
  let current_score: number;
  let best_prob = user.best_prob;

  if (isSuccess) {
    result = "success";
    current_score = current * chosen;
    if (best_prob == null || current_score < best_prob) {
      best_prob = current_score;
      await run(`UPDATE users SET best_prob = ? WHERE id = ?`, [
        best_prob,
        user.id,
      ]);
    }
  } else {
    result = "fail";
    current_score = 1.0;
  }

  const updated = await get<DbUser>(
    `SELECT id, nickname, best_prob, coins
     FROM users WHERE id = ?`,
    [user.id]
  );

  const best_score = updated?.best_prob ?? null;

  let rank: number | null = null;
  if (best_score !== null) {
    const row = await get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt
       FROM users
       WHERE best_prob IS NOT NULL AND best_prob < ?`,
      [best_score]
    );
    rank = (row?.cnt ?? 0) + 1;
  }

  return res.json({
    result,
    current_score,
    best_score,
    rank,
  });
});

/** 광고 보상 */
router.post("/reward-ad", async (req: any, res: any) => {
  const user = await findUserByCookie(req);
  if (!user) return res.json({ error: "NO_AUTH" });

  await run(
    `UPDATE users
     SET coins = COALESCE(coins, 0) + 20
     WHERE id = ?`,
    [user.id]
  );

  return res.json({ ok: true });
});

/** TOP 100 */
router.get("/ranking", async (_req: any, res: any) => {
  const rows = await all<{
    nickname: string;
    bestProb: number | null;
  }>(
    `SELECT nickname, best_prob AS bestProb
     FROM users
     WHERE nickname IS NOT NULL
     ORDER BY best_prob ASC
     LIMIT 100`
  );

  return res.json({ ok: true, rows });
});

export default router;
