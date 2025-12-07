# ---- Build stage ----
FROM node:20 AS builder
WORKDIR /app

# server 전용 package.json 복사
COPY package*.json ./
RUN npm ci

# server 소스 전체 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

# prod dependencies 설치
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# 빌드 결과만 복사
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
