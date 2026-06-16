ARG NODE_VERSION=22-slim

# ============================================================
# base: runtime dependencies (ffmpeg, python3, yt-dlp)
# ============================================================
FROM node:${NODE_VERSION} AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    pip \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --break-system-packages --no-cache-dir yt-dlp

# ============================================================
# deps: production node_modules
# ============================================================
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ============================================================
# builder: full build with devDependencies
# ============================================================
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ============================================================
# runner: минимальный образ для production
# ============================================================
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 youbox && \
    adduser --system --uid 1001 youbox

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules

COPY healthcheck.sh /healthcheck.sh
RUN chmod +x /healthcheck.sh

RUN mkdir -p /data/db /data/downloads /data/tmp && \
    chown -R youbox:youbox /data

USER youbox

EXPOSE 3007

ENV NODE_ENV=production
ENV PORT=3007
ENV DATA_DIR=/data
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD /healthcheck.sh

CMD ["node", "server.js"]
