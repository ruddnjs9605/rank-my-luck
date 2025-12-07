# ================================
# 1) Build Stage
# ================================
FROM node:20 AS builder
WORKDIR /app

# package.json & lock 파일 먼저 복사 → 캐시 최적화
COPY package*.json ./
RUN npm ci

# 소스 전체 복사
COPY . .

# TypeScript 빌드 → dist 생성
RUN npm run build


# ================================
# 2) Runtime Stage
# ================================
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

# Runtime dependencies 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 결과물(dist) 복사
COPY --from=builder /app/dist ./dist

# (선택) public, db 등 필요한 리소스 복사
COPY --from=builder /app/public ./public
# COPY --from=builder /app/db ./db   # 필요하면 활성화

CMD ["node", "dist/index.js"]
