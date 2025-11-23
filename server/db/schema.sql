PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  nickname TEXT UNIQUE,
  toss_user_key TEXT UNIQUE,

  best_prob REAL,
  coins INTEGER NOT NULL DEFAULT 40,
  referral_points INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_best_prob ON users(best_prob);

CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  success_count INTEGER NOT NULL,
  trial_count INTEGER NOT NULL,
  prob REAL NOT NULL,

  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plays_user_id ON plays(user_id);

-- 추천인 보상 기록 (한 번만 청구하도록 claimer_id UNIQUE)
CREATE TABLE IF NOT EXISTS referral_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claimer_id INTEGER NOT NULL UNIQUE,
  referrer_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (claimer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_claims(referrer_id);

-- 일별 집계 기록 (22:00 KST 기준)
CREATE TABLE IF NOT EXISTS daily_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE, -- YYYY-MM-DD (집계 날짜, 윈도우 시작 시점 기준)
  participants INTEGER NOT NULL,
  prize_pool INTEGER NOT NULL,
  winner_user_id INTEGER,
  winner_best_prob REAL,
  payout_status TEXT DEFAULT 'PENDING', -- PENDING/SENT/FAILED/SKIPPED
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 일별 랭킹 스냅샷 (Top 100 보관)
CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  best_prob REAL NOT NULL,
  rank INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);

-- 포인트 지급 로그
CREATE TABLE IF NOT EXISTS payout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  status TEXT NOT NULL, -- PENDING/SENT/FAILED
  request_payload TEXT,
  response_payload TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
