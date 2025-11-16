PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  nickname TEXT UNIQUE,
  toss_user_key TEXT UNIQUE,

  best_prob REAL,
  coins INTEGER NOT NULL DEFAULT 100,
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
