PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- users 테이블 (닉네임 UNIQUE, toss_user_key UNIQUE)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT UNIQUE,
  toss_user_key TEXT UNIQUE,
  best_prob REAL, -- 누적성공 확률 중 최저값(작을수록 레어)
  created_at TEXT DEFAULT (datetime('now'))
);

-- 플레이 기록(선택)
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  trial_count INTEGER NOT NULL,
  prob REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_best_prob ON users(best_prob);
CREATE INDEX IF NOT EXISTS idx_plays_user_id ON plays(user_id);
