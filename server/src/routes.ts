import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { all, get, run } from './db.js';
import { exchangeCodeForToken, fetchTossMe, decryptTossUser } from './toss.js';

const router = Router();

/**
 * 닉네임 중복 체크 & 생성 (토스 로그인 후 최초 1회)
 * body: { nickname: string, tossUserKey?: string }
 */
router.post('/auth/nickname', async (req: Request, res: Response) => {
  const Body = z.object({
    nickname: z.string().min(2).max(20),
    tossUserKey: z.string().optional(),
  });

  const body = Body.parse(req.body);

  // 중복 검사
  const existed = await get<{ id: number }>(
    'SELECT id FROM users WHERE nickname = ?',
    [body.nickname]
  );

  if (existed) {
    return res
      .status(409)
      .json({ ok: false, message: '닉네임이 이미 사용중입니다.' });
  }

  // 생성
  await run(
    `INSERT INTO users (nickname, toss_user_key, best_prob) VALUES (?, ?, NULL)`,
    [body.nickname, body.tossUserKey || null]
  );

  const user = await get<{
    id: number;
    nickname: string | null;
    tossUserKey: string | null;
    bestProb: number | null;
  }>(
    `SELECT id, nickname, toss_user_key as tossUserKey, best_prob as bestProb
     FROM users
     WHERE nickname = ?`,
    [body.nickname]
  );

  return res.json({ ok: true, user });
});

/**
 * 토스 인가코드 → 토큰 교환
 * body: { code: string }
 */
router.post('/toss/exchange', async (req: Request, res: Response) => {
  const Body = z.object({ code: z.string().min(1) });
  const { code } = Body.parse(req.body);

  try {
    const token = await exchangeCodeForToken(code);
    return res.json({ ok: true, token });
  } catch (e: any) {
    return res
      .status(400)
      .json({ ok: false, message: e?.message || '토큰 교환 실패' });
  }
});

/**
 * 토스 me 조회 → 복호화 → 우리 DB upsert
 * body: { accessToken: string }
 */
router.post('/toss/me', async (req: Request, res: Response) => {
  const Body = z.object({ accessToken: z.string().min(1) });
  const { accessToken } = Body.parse(req.body);

  try {
    const encrypted = await fetchTossMe(accessToken);
    const decrypted = await decryptTossUser(encrypted);

    // tossUserKey 기준 upsert
    const row = await get<{ id: number }>(
      'SELECT id FROM users WHERE toss_user_key = ?',
      [decrypted.tossUserKey]
    );

    if (!row) {
      await run(
        `INSERT INTO users (toss_user_key, nickname, best_prob)
         VALUES (?, NULL, NULL)`,
        [decrypted.tossUserKey]
      );
    }

    const user = await get<{
      id: number;
      nickname: string | null;
      tossUserKey: string | null;
      bestProb: number | null;
    }>(
      `SELECT id, nickname, toss_user_key as tossUserKey, best_prob as bestProb
       FROM users
       WHERE toss_user_key = ?`,
      [decrypted.tossUserKey]
    );

    return res.json({ ok: true, user, decrypted });
  } catch (e: any) {
    return res
      .status(400)
      .json({ ok: false, message: e?.message || '유저 조회 실패' });
  }
});

/**
 * 랭킹 조회: best_prob 기준 상위 100명
 */
router.get('/ranking', async (_req: Request, res: Response) => {
  const rows = await all<{ nickname: string; bestProb: number | null }>(
    `SELECT nickname, best_prob as bestProb
     FROM users
     WHERE nickname IS NOT NULL
     ORDER BY best_prob ASC NULLS LAST
     LIMIT 100`
  );

  return res.json({ ok: true, rows });
});

export default router;
