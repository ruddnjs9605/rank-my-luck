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


-- 1) 사용자 지갑
ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;

-- 2) 추천 보상 (한 사용자당 1회만 보상)
CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 50,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3) 광고 보상 지급 로그 (중복 지급 방지용 키)
CREATE TABLE IF NOT EXISTS ad_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
