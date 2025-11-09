import { Router } from "express";
import { all, get, run } from "./db.js";
import jwt from "jsonwebtoken";

const r = Router();

/** 인증 미들웨어 */
const auth = async (req: any, res: any, next: any) => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET!);
    req.user = payload; // { user_id }
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/** 개발용 토큰 발급 (실서비스는 OAuth 콜백 처리) */
r.get("/auth/toss/callback", async (req, res) => {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "SERVER_MISCONFIG:JWT_SECRET" });
    }
    const qUserId = String(req.query.user_id || "");
    if (!qUserId) return res.status(400).json({ error: "user_id required (dev mode)" });
  
    await run(`INSERT OR IGNORE INTO users(user_id) VALUES (?)`, [qUserId]);
    const token = jwt.sign({ user_id: qUserId }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token });
  });

/** 내 프로필 */
r.get("/api/me", auth, async (req: any, res) => {
  const me = await get(
    `SELECT id, user_id, nickname, best_score, coins, created_at
       FROM users
      WHERE user_id = ?`,
    [req.user.user_id]
  );
  res.json(me);
});

/** 닉네임 설정 + 최초 코인(50) 보장 */
r.post("/api/nickname", auth, async (req: any, res) => {
  const { nickname } = req.body ?? {};
  if (!nickname) return res.status(400).json({ error: "nickname required" });

  try {
    await run(`UPDATE users SET nickname = ? WHERE user_id = ?`, [nickname, req.user.user_id]);
    // 최초 보정: coins < 50 이면 50으로
    await run(
      `UPDATE users SET coins = CASE WHEN coins < 50 THEN 50 ELSE coins END WHERE user_id = ?`,
      [req.user.user_id]
    );

    const me = await get(
      `SELECT id, user_id, nickname, best_score, coins, created_at FROM users WHERE user_id = ?`,
      [req.user.user_id]
    );
    res.json(me);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "DUPLICATE_NICKNAME" });
    }
    throw e;
  }
});

/** 플레이(실패 시만 코인 -1, 코인 0이면 불가) */
r.post("/api/play", auth, async (req: any, res) => {
  const { chosen_prob, prev_score } = req.body ?? {};
  const p = Number(chosen_prob);
  if (!(p >= 0.1 && p <= 0.9)) return res.status(400).json({ error: "prob must be 0.1~0.9" });

  const me = await get<{ best_score: number; coins: number }>(
    `SELECT best_score, coins FROM users WHERE user_id = ?`,
    [req.user.user_id]
  );
  if (!me) return res.status(404).json({ error: "NOT_FOUND" });

  if (me.coins <= 0) return res.status(402).json({ error: "NO_COINS" });

  const before = prev_score ? Number(prev_score) : 1.0;
  const rnd = Math.random();
  const success = rnd < p;

  let current = 1.0;
  let best = me.best_score;

  await run("BEGIN");
  try {
    if (success) {
      current = before * p;
      if (current < best) {
        await run(`UPDATE users SET best_score = ? WHERE user_id = ?`, [current, req.user.user_id]);
        best = current;
      }
    } else {
      current = 1.0;
      await run(`UPDATE users SET coins = coins - 1 WHERE user_id = ? AND coins > 0`, [req.user.user_id]);
    }

    await run(
      `INSERT INTO records(user_id, current_score, chosen_prob, result)
       VALUES (?, ?, ?, ?)`,
      [req.user.user_id, current, p, success ? "success" : "fail"]
    );

    await run("COMMIT");
  } catch (e) {
    await run("ROLLBACK");
    throw e;
  }

  const myRankRow = await get<{ rank: number }>(
    `WITH ranked AS(
       SELECT user_id, RANK() OVER (ORDER BY best_score ASC, created_at ASC) r
       FROM users
     ) SELECT r AS rank FROM ranked WHERE user_id = ?`,
    [req.user.user_id]
  );

  res.json({
    result: success ? "success" : "fail",
    current_score: current,
    best_score: best,
    rank: myRankRow?.rank ?? null
  });
});

/** 내 코인 조회 */
r.get("/api/wallet", auth, async (req: any, res) => {
  const row = await get<{ coins: number }>(
    `SELECT coins FROM users WHERE user_id = ?`,
    [req.user.user_id]
  );
  res.json({ coins: row?.coins ?? 0 });
});

/** 광고 보상(+20) — idempotencyKey로 중복 방지 */
r.post("/api/ads/reward", auth, async (req: any, res) => {
  const { idempotencyKey } = req.body ?? {};
  if (!idempotencyKey) return res.status(400).json({ error: "IDEMPOTENCY_KEY_REQUIRED" });

  try {
    await run("BEGIN");
    await run(
      `INSERT INTO ad_rewards(user_id, amount, idempotency_key) VALUES(?, ?, ?)`,
      [req.user.user_id, 20, idempotencyKey]
    );
    await run(`UPDATE users SET coins = coins + 20 WHERE user_id = ?`, [req.user.user_id]);
    await run("COMMIT");
    res.json({ ok: true, delta: +20 });
  } catch (e: any) {
    await run("ROLLBACK");
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "DUPLICATE_REWARD" });
    }
    throw e;
  }
});

/** 추천 보상(+50) — 자신 제외, 1회만 */
r.post("/api/referral/claim", auth, async (req: any, res) => {
  const { referrer_user_id } = req.body ?? {};
  if (!referrer_user_id) return res.status(400).json({ error: "REFERRER_REQUIRED" });
  if (referrer_user_id === req.user.user_id) return res.status(400).json({ error: "SELF_REFERRAL_FORBIDDEN" });

  try {
    await run("BEGIN");

    const exists = await get(`SELECT 1 FROM referral_rewards WHERE referred_user_id = ?`, [req.user.user_id]);
    if (exists) {
      await run("ROLLBACK");
      return res.status(409).json({ error: "ALREADY_REWARDED" });
    }

    await run(
      `INSERT INTO referral_rewards(referrer_user_id, referred_user_id, amount) VALUES(?, ?, 50)`,
      [referrer_user_id, req.user.user_id]
    );
    await run(`UPDATE users SET coins = coins + 50 WHERE user_id = ?`, [referrer_user_id]);

    await run("COMMIT");
    res.json({ ok: true, delta: +50, to: referrer_user_id });
  } catch (e) {
    await run("ROLLBACK");
    throw e;
  }
});

/** 리더보드: Top 100 + 내 랭크 */
r.get("/api/leaderboard", auth, async (req: any, res) => {
  const TOP_N = 100;

  const top = await all<{ nickname: string; best_score: number }>(
    `SELECT nickname, best_score
       FROM users
      WHERE nickname IS NOT NULL
      ORDER BY best_score ASC, created_at ASC
      LIMIT ?`,
    [TOP_N]
  );

  let me: { nickname: string | null; best_score: number; rank: number | null; user_id: string } | null = null;
  const my = await get<{ nickname: string | null; best_score: number; user_id: string }>(
    `SELECT nickname, best_score, user_id FROM users WHERE user_id = ?`,
    [req.user.user_id]
  );

  if (my) {
    const rnk = await get<{ rank: number }>(
      `WITH ranked AS (
         SELECT user_id,
                RANK() OVER (ORDER BY best_score ASC, created_at ASC) AS r
           FROM users
       )
       SELECT r AS rank FROM ranked WHERE user_id = ?`,
      [req.user.user_id]
    );
    me = { nickname: my.nickname ?? null, best_score: my.best_score, rank: rnk?.rank ?? null, user_id: my.user_id };
  }

  res.json({ top, me });
});

export default r;
