# 深惠人生模拟 — standalone server image (Node + SQLite, no Muse needed).
#   docker build -t shenhui-life .
#   docker run -d -p 8787:8787 -v shenhui-data:/data --name shenhui shenhui-life
# The SQLite database (players, chat, gifts, cloud saves) lives in /data.

FROM node:20-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 ships prebuilt binaries; the toolchain is only a fallback.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY standalone/package.json standalone/package-lock.json standalone/link-root.mjs standalone/
COPY standalone/sdk standalone/sdk
RUN cd standalone && npm ci
COPY client client
COPY server server
COPY drizzle drizzle
COPY standalone standalone
RUN cd standalone && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=build /app /app
ENV HOST=0.0.0.0 PORT=8787 DB_PATH=/data/app.db NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
WORKDIR /app/standalone
CMD ["npx", "tsx", "server.ts"]
