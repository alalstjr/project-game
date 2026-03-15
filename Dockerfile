FROM node:18-slim AS builder

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# 소스 복사
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
COPY client/ client/

# shared 빌드
RUN npm run build -w shared

# 클라이언트 빌드
RUN npm run build -w client

# 서버 빌드
RUN npm run build -w server

# ===== 프로덕션 =====
FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev --workspace=server --workspace=shared 2>/dev/null || npm ci --omit=dev

# 빌드 결과물 복사
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist client/dist
COPY --from=builder /app/shared/dist shared/dist

# 데이터 디렉토리
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/game.db
ENV JWT_SECRET=pokemon-gacha-secret-key-2026

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
