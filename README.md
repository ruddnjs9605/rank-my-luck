## Rank My Luck

간단한 토스 미니앱(웹)용 운빨 게임. 프런트는 Vite/React, 백엔드는 Express + SQLite 입니다.

### 빠른 시작
- Node 18+ 설치
- 클라이언트: `cd client && npm install`
- 서버: `cd server && npm install`
- 로컬 DB 초기화: `npm run db:reset` (server 디렉터리에서)
- 개발 실행: `npm run dev` (server) / `npm run dev` (client)

### 필수 환경변수
서버 (`server/.env` 등):
- `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `TOSS_TOKEN_URL`, `TOSS_ME_URL`, `TOSS_DECRYPTION_KEY` (+ `TOSS_KEY_FORMAT` 기본 hex)
- `CORS_ORIGIN` : 허용할 Origin 목록(쉼표 구분). 예: `http://localhost:5173,https://yourdomain`  
  > 쿠키 인증을 쓰므로 와일드카드 `*`를 쓰지 않습니다.
- `PORT`(기본 8080), `DB_PATH`(기본 `server/db/dev.sqlite`)
- `USE_DEV_FALLBACK` : `0`으로 두면 로그인 필수, 빈 값이면 로컬에서 게스트로 테스트 허용
- `ADMIN_TOKEN` : 일일 집계/포인트 지급 admin API 보호용 토큰
- `PAYOUT_SIMULATE=1` : 포인트 지급을 실제 호출 없이 성공 처리하는 플래그(테스트용)
- 토스 포인트 지급용:
  - `TOSS_PROMOTION_CODE`
  - `TOSS_PROMOTION_ACCESS_TOKEN` (AppsInToss API bearer 토큰)

클라이언트 (`client/.env`):
- `VITE_API_BASE_URL` : 예) 로컬 서버 `http://localhost:8080`

### 주요 명령
- 서버 빌드/실행: `npm run build` / `npm start`
- 서버 개발: `npm run dev`
- DB 리셋(스키마+시드): `npm run db:reset` (로컬 DB 변경 시 다시 실행)
- 클라이언트 빌드/미리보기: `npm run build` / `npm run preview`

### 배포 노트
- Cloud Run 등 HTTPS 프록시 뒤에 둘 때 `trust proxy` 이미 설정됨.
- CORS는 `CORS_ORIGIN` allowlist 기반이며 쿠키(`credentials: true`)로 인증합니다.
- 쿠키 설정: prod에서는 `SameSite=None; Secure`, dev에서는 `SameSite=Lax`.
- Cloud Scheduler: 매일 22:00 KST `POST /admin/daily-close` 호출 시 `x-admin-token: $ADMIN_TOKEN` 헤더 필요. 포인트 지급은 `POST /admin/process-payouts`로 수동/추가 실행.

### 기능 메모
- 광고 보상: 중복 키/쿨다운(30초) 체크 후 코인 +20.
- 추천인: 동일 계정 1회만 청구, 자기 자신 불가. 추천인/청구자 모두 코인 +20, 추천인 포인트 +1.
- 랭킹: Top 100 + 내 순위/기록 반환.
