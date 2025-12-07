# ---- Build stage ----
FROM node:20 AS builder
WORKDIR /app

# server 폴더만 복사
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
