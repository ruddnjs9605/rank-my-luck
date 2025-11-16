# ---- Build stage ----
FROM node:20 AS builder
WORKDIR /app

# 1. 의존성 설치 - server 폴더 기준이므로 'server/' prefix 필요 없음
COPY package*.json ./
RUN npm ci

# 2. 소스 전체 복사 (ts, tsconfig, db 등 전부)
COPY . .

# 3. 타입스크립트 빌드 (dist 생성)
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim
WORKDIR /app

# 환경 변수
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# 4. 실행에 필요한 패키지 설치 (prod only)
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# 5. 빌드 결과물 복사
COPY --from=builder /app/dist ./dist

# (SQLite를 이미지에 포함해 테스트할 경우, server/db 폴더가 있다면 주석 해제)
# COPY --from=builder /app/db ./db

# 6. 서버 실행
CMD ["node", "dist/index.js"]
