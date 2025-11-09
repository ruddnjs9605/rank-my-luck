import { Router } from "express";
import { all, get, run } from "./db.js";
import jwt from "jsonwebtoken";

const r = Router();

/** 인증 미들웨어 (Authorization: Bearer <token>) */
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

/**
 * 개발 편의용 Toss OAuth 콜백 (실서비스에서는 code→access_token→user_id 교환)
 * GET /auth/toss/callback?user_id=dev-user-1
 * 응답: { token }
 */
r.get("/auth/toss/callback", async (req, res) => {
  const qUserId = String(req.query.user_id || "");
  if (!qUserId) return res.status(400).json({ error: "user_id required (dev mode)" });

  await run(`INSERT OR IGNORE INTO users(user_id) VALUES (?)`, [qUserId]);

  const token = jwt.sign({ user_id: qUserId }, process.env.JWT_SECRET!, { expiresIn: "30d" });
  res.json({ token });
});

/** 내 프로필 */
r.get("/api/me", auth, async (req: any, res) => {
  const me = await get(
    `SELECT id, user_id, nickname, best_score, created_at
       FROM users
      WHERE user_id = ?`,
    [req.user.user_id]
  );
  res.json(me);
});

/** 닉네임 설정(중복 불가) */
r.post("/api/nickname", auth, async (req: any, res) => {
  const { nickname } = req.body ?? {};
  if (!nickname) return res.status(400).json({ error: "nickname required" });

  try {
    await run(`UPDATE users SET nickname = ? WHERE user_id = ?`, [nickname, req.user.user_id]);
    const me = await get(
      `SELECT id, user_id, nickname, best_score, created_at
         FROM users
        WHERE user_id = ?`,
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

/**
 * 플레이(코인 토스)
 * req.body: { chosen_prob:number, prev_score?:number }
 * 응답: { result, current_score, best_score, rank, entered_top10 }
 */
r.post("/api/play", auth, async (req: any, res) => {
  const { chosen_prob, prev_score } = req.body ?? {};
  const p = Number(chosen_prob);
  if (!(p >= 0.1 && p <= 0.9)) return res.status(400).json({ error: "prob must be 0.1~0.9" });

  const rnd = Math.random();
  const success = rnd < p;

  const before = prev_score ? Number(prev_score) : 1.0;

  let current = 1.0;
  let best = (
    await get<{ best_score: number }>(`SELECT best_score FROM users WHERE user_id=?`, [req.user.user_id])
  ).best_score;

  if (success) {
    current = before * p;
    if (current < best) {
      await run(`UPDATE users SET best_score = ? WHERE user_id = ?`, [current, req.user.user_id]);
      best = current;
    }
  } else {
    current = 1.0;
  }

  await run(
    `INSERT INTO records(user_id, current_score, chosen_prob, result)
     VALUES (?, ?, ?, ?)`,
    [req.user.user_id, current, p, success ? "success" : "fail"]
  );

  // 내 현재 랭킹 계산 (작을수록 상위)
  const rows = await all<{ user_id: string; best_score: number; rank: number }>(
    `WITH ranked AS (
       SELECT user_id, best_score,
              RANK() OVER (ORDER BY best_score ASC, created_at ASC) AS r
         FROM users
     )
     SELECT user_id, best_score, r as rank
       FROM ranked
      WHERE user_id = ?`,
    [req.user.user_id]
  );
  const myRank = rows[0]?.rank ?? null;

  let entered_top10 = false;
  if (success && best === current && myRank && myRank <= 10) {
    entered_top10 = true;
  }

  res.json({
    result: success ? "success" : "fail",
    current_score: current,
    best_score: best,
    rank: myRank,
    entered_top10
  });
});

/**
 * 리더보드: Top 100 + 내 순위
 * 응답: { top: Array<{nickname,best_score}>, me: {nickname,best_score,rank}|null }
 */
r.get("/api/leaderboard", auth, async (req: any, res) => {
  const TOP_N = 100;

  // Top 100 (닉네임 설정된 사용자만)
  const top = await all<{ nickname: string; best_score: number }>(
    `SELECT nickname, best_score
       FROM users
      WHERE nickname IS NOT NULL
      ORDER BY best_score ASC, created_at ASC
      LIMIT ?`,
    [TOP_N]
  );

  // 내 순위(닉네임/점수/랭크)
  let me: { nickname: string | null; best_score: number; rank: number | null } | null = null;
  const my = await get<{ nickname: string | null; best_score: number }>(
    `SELECT nickname, best_score FROM users WHERE user_id = ?`,
    [req.user.user_id]
  );

  if (my) {
    const rnk = await get<{ rank: number }>(
      `WITH ranked AS (
         SELECT user_id,
                RANK() OVER (ORDER BY best_score ASC, created_at ASC) AS r
           FROM users
       )
       SELECT r AS rank
         FROM ranked
        WHERE user_id = ?`,
      [req.user.user_id]
    );
    me = { nickname: my.nickname ?? null, best_score: my.best_score, rank: rnk?.rank ?? null };
  }

  res.json({ top, me });
});

export default r;
