import { Router } from "express";
import { get, all, run } from "./db.js";

const router = Router();

/** 닉네임 설정 */
router.post("/auth/nickname", async (req, res) => {
  const { nickname } = req.body;

  const exists = await get(`SELECT id FROM users WHERE nickname = ?`, [nickname]);
  if (exists) return res.status(409).json({ error: "DUPLICATE_NICKNAME" });

  await run(`INSERT INTO users (nickname, best_prob) VALUES (?, NULL)`, [nickname]);

  const user = await get(
    `SELECT id, nickname, best_prob as bestProb FROM users WHERE nickname = ?`,
    [nickname]
  );

  res.json({ ok: true, user });
});

/** 추천(referral) 보상 */
router.post("/referral/claim", async (req, res) => {
  const { ref } = req.body;

  if (!ref) return res.status(400).json({ error: "NO_REF" });

  // 예: 추천코드 = 유저ID 로 가정
  const exists = await get(`SELECT id FROM users WHERE id = ?`, [ref]);
  if (!exists) return res.status(404).json({ error: "REF_NOT_FOUND" });

  // 예시: 추천 보상 횟수 적립
  await run(`UPDATE users SET referral_points = COALESCE(referral_points,0) + 1
             WHERE id = ?`, [ref]);

  res.json({ ok: true });
});

/** Top100 */
router.get("/ranking", async (_req, res) => {
  const rows = await all(
    `SELECT nickname, best_prob as bestProb
     FROM users
     WHERE nickname IS NOT NULL
     ORDER BY best_prob ASC NULLS LAST
     LIMIT 100`
  );
  res.json({ ok: true, rows });
});

export default router;
