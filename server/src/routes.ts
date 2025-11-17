// server/src/routes.ts
import { Router } from "express";
import { get, all, run } from "./db.js";
import type { UserRow } from "./types.js";

const router = Router();

/** 공통: 현재 유저(가장 최근 생성된 유저) 가져오기 */
async function getCurrentUser(): Promise<UserRow> {
  let user = await get<UserRow>(
    `SELECT * FROM users ORDER BY id DESC LIMIT 1`
  );

  if (!user) {
    // 아직 유저가 하나도 없다면 게스트 유저 생성
    await run(
      `INSERT INTO users (nickname, best_prob, coins, referral_points)
       VALUES ('게스트', NULL, 100, 0)`
    );
    user = (await get<UserRow>(
      `SELECT * FROM users ORDER BY id DESC LIMIT 1`
    ))!;
  }

  return user;
}

/** 1) 내 정보 조회 (/api/me) */
router.get("/me", async (_req, res) => {
  const u = await getCurrentUser();
  res.json({
    nickname: u.nickname,
    best_score: u.best_prob,
    coins: u.coins ?? 0,
  });
});

/** 2) 지갑 조회 (/api/wallet) */
router.get("/wallet", async (_req, res) => {
  const u = await getCurrentUser();
  res.json({ coins: u.coins ?? 0 });
});

/** 3) 닉네임 설정 (/api/auth/nickname) */
router.post("/auth/nickname", async (req, res) => {
  const { nickname } = req.body as { nickname?: string };

  if (!nickname || !nickname.trim()) {
    return res
      .status(400)
      .json({ error: "BAD_NICK", message: "닉네임을 입력해 주세요." });
  }

  const exists = await get<{ id: number }>(
    `SELECT id FROM users WHERE nickname = ?`,
    [nickname.trim()]
  );
  if (exists) {
    return res
      .status(409)
      .json({ error: "DUPLICATE_NICKNAME", message: "이미 사용 중인 닉네임입니다." });
  }

  await run(
    `INSERT INTO users (nickname, best_prob)
     VALUES (?, NULL)`,
    [nickname.trim()]
  );

  const user = await get<{
    id: number;
    nickname: string;
    best_prob: number | null;
  }>(
    `SELECT id, nickname, best_prob
     FROM users
     WHERE nickname = ?
     ORDER BY id DESC LIMIT 1`,
    [nickname.trim()]
  );

  res.json({
    user: {
      id: user!.id,
      nickname: user!.nickname,
      best_score: user!.best_prob,
    },
  });
});

/** 4) 플레이 (/api/play) */
router.post("/play", async (req, res) => {
  const { chosen, current } = req.body as {
    chosen: number;
    current: number;
  };

  const u = await getCurrentUser();

  // 코인 부족
  if (!u.coins || u.coins <= 0) {
    return res
      .status(400)
      .json({ error: "NO_COINS", message: "코인이 부족합니다." });
  }

  // 성공 / 실패 랜덤
  const success = Math.random() < chosen;

  let newCurrent = current;
  if (success) {
    newCurrent = current * chosen;
  } else {
    newCurrent = 1.0;
  }

  let newBest = u.best_prob ?? 1.0;
  if (success && newCurrent < newBest) {
    newBest = newCurrent;
  }

  // DB 업데이트: 코인 1개 소모 + 베스트 갱신
  await run(
    `UPDATE users
     SET coins = coins - 1,
         best_prob = ?
     WHERE id = ?`,
    [newBest, u.id]
  );

  // 플레이 기록 저장 (선택적)
  await run(
    `INSERT INTO plays (user_id, success_count, trial_count, prob)
     VALUES (?, ?, ?, ?)`,
    [u.id, success ? 1 : 0, 1, newCurrent]
  );

  // 랭킹 계산: best_prob가 더 낮은(희박한) 사람 수 + 1
  const rankRow = await get<{ rank: number }>(
    `SELECT COUNT(*) + 1 AS rank
     FROM users
     WHERE best_prob IS NOT NULL
       AND best_prob < ?`,
    [newBest]
  );
  const rank = rankRow?.rank ?? null;

  res.json({
    result: success ? "success" : "fail",
    current_score: newCurrent,
    best_score: newBest,
    rank,
  });
});

/** 5) 광고 보상 (/api/reward-ad) */
router.post("/reward-ad", async (_req, res) => {
  const u = await getCurrentUser();
  await run(
    `UPDATE users
     SET coins = coins + 20
     WHERE id = ?`,
    [u.id]
  );
  res.json({ ok: true });
});

/** 6) 추천(referral) 보상 (/api/referral/claim) */
router.post("/referral/claim", async (req, res) => {
  const { ref } = req.body as { ref?: string };

  if (!ref) return res.status(400).json({ error: "NO_REF" });

  const exists = await get<{ id: number }>(
    `SELECT id FROM users WHERE id = ?`,
    [ref]
  );
  if (!exists) return res.status(404).json({ error: "REF_NOT_FOUND" });

  await run(
    `UPDATE users
     SET referral_points = COALESCE(referral_points, 0) + 1
     WHERE id = ?`,
    [ref]
  );

  res.json({ ok: true });
});

/** 7) Top100 랭킹 (/api/ranking) */
router.get("/ranking", async (_req, res) => {
  const rows = await all<{
    nickname: string;
    bestProb: number | null;
  }>(
    `SELECT nickname,
            best_prob AS bestProb
     FROM users
     WHERE nickname IS NOT NULL
       AND best_prob IS NOT NULL
     ORDER BY best_prob ASC
     LIMIT 100`
  );

  res.json({ ok: true, rows });
});

export default router;
