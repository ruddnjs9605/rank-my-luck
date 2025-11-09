PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- users: 토스 인증 user_id 1:1, 닉네임 유니크, best_score는 "작을수록 더 어려운 기록" (누적확률)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  nickname TEXT UNIQUE,
  best_score REAL DEFAULT 1.0,        -- 시작은 1(=100%); 더 작아질수록 신기록
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- records: 선택 사항(세션/시도 로그)
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  current_score REAL NOT NULL,
  chosen_prob REAL NOT NULL,
  result TEXT CHECK (result IN ('success','fail')) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_users_best_score ON users(best_score ASC);
CREATE INDEX IF NOT EXISTS idx_records_user_time ON records(user_id, timestamp DESC);
