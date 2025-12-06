## Rank My Luck

토스 미니앱용 나의 운을 확인해보는 앱입니다. 프런트는 Vite/React, 백엔드는 Express + PostgreSQL(Cloud SQL)입니다.

### 로컬 개발
- 요구: Node 18+, psql
- 클라이언트: `cd client && npm install && npm run dev` (VITE_API_BASE_URL을 로컬 API로 설정)
- 서버: `cd server && npm install && npm run dev`
  - Postgres 연결 정보는 `.env`에 설정(DB_HOST/PORT/USER/PASS/NAME/SSL 등)
  - dev fallback이 켜져 있으면 로그인 없이 게스트로 테스트 가능 (`USE_DEV_FALLBACK=1`)

### 주요 환경변수
- 클라이언트(`client/.env`): `VITE_API_BASE_URL=https://<cloud-run-url>` (Netlify에도 동일 설정)
- 서버(`server/.env` 예시):
```
PORT=8080
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASS=...
DB_NAME=...
DB_SSL=1
DB_POOL_SIZE=10
CORS_ORIGIN=https://your-frontend
USE_DEV_FALLBACK=0
ADMIN_TOKEN=...
PAYOUT_SIMULATE=0
TOSS_TOKEN_URL=https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token
TOSS_ME_URL=https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me
TOSS_DECRYPTION_KEY=...
TOSS_KEY_FORMAT=hex
TOSS_PROMOTION_CODE=...      # 선택
TOSS_PROMOTION_ACCESS_TOKEN=... # 선택
TOSS_DISCONNECT_BASIC_AUTH=Basic ...
```

### DB 스키마 (Postgres)
Cloud SQL에 아래 테이블이 필요합니다: `users`, `plays`, `referral_claims`, `daily_runs`, `daily_scores`, `payout_logs` (SERIAL/DOUBLE PRECISION/TIMESTAMPTZ 버전으로 생성).

### 배포
- 서버: Cloud Build/Cloud Run
  - `cloudbuild.yaml`에서 gcloud run deploy 시 `--set-env-vars`에 필요한 env를 모두 주입합니다.
  - substitutions는 Cloud Build 트리거에서 실제 값으로 설정(예: _DB_HOST 등).
  필요한부분 트리거에서 직접입력으로변경
  - Cloud Run env에 `USE_DEV_FALLBACK=0`, `PAYOUT_SIMULATE=0`, `CORS_ORIGIN`을 프런트 도메인으로 설정.
- 프런트: Netlify
  - `VITE_API_BASE_URL`을 Cloud Run API URL로 설정
  - SPA 라우팅을 위해 `_redirects`(`/* /index.html 200`) 포함 권장
  - CORS_ORIGIN에 Netlify/커스텀 도메인을 포함

### 스케줄/이벤트
- 매일 22:00 KST 집계/리셋: Cloud Scheduler → `POST /admin/daily-close` (헤더 `x-admin-token: $ADMIN_TOKEN`)
- 포인트 지급 처리: 필요 시 `POST /admin/process-payouts` (동일 헤더)
- 일일 코인 보충: 40 미만이면 40으로 보충

### 기능 메모
- 토스 로그인: 미니앱에서 `appLogin()` → 서버 `/api/auth/toss-login`(authorizationCode + referrer)
- 광고 보상: 보상형 광고 성공 시 코인 +20(쿨다운/중복키 체크)
- 추천인: referrer만 +30코인, 자기 자신 불가, 1회 제한
- 랭킹: Top 100 + 내 순위/기록 반환, 22시 리셋
- 연결 끊기 콜백: `/api/toss/disconnect` (Authorization 헤더가 `TOSS_DISCONNECT_BASIC_AUTH`와 일치해야 200 OK)
- 약관: `client/public/terms.html` (서비스 이용약관) URL을 토스 콘솔에 등록



변경한 내역이 많아서 정리 하기 힘듬

CORS_ORIGIN 을 하나로만 저장하기