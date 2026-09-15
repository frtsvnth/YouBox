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

# yt-dlp + опциональный плагин для bgutil PO Token provider (используется только если задан POT_PROVIDER_URL)
RUN pip install --break-system-packages --no-cache-dir yt-dlp bgutil-ytdlp-pot-provider

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

ARG ENABLE_COOKIE_AUTO_REFRESH
ARG COOKIE_REFRESH_INTERVAL_MINUTES
ARG COOKIE_SOURCE_COOLDOWN_MINUTES
ARG GOOGLE_ACCOUNT_1_EMAIL
ARG GOOGLE_ACCOUNT_1_PASSWORD
ARG GOOGLE_ACCOUNT_2_EMAIL
ARG GOOGLE_ACCOUNT_2_PASSWORD
ARG POT_PROVIDER_URL

ENV ENABLE_COOKIE_AUTO_REFRESH=${ENABLE_COOKIE_AUTO_REFRESH}
ENV COOKIE_REFRESH_INTERVAL_MINUTES=${COOKIE_REFRESH_INTERVAL_MINUTES}
ENV COOKIE_SOURCE_COOLDOWN_MINUTES=${COOKIE_SOURCE_COOLDOWN_MINUTES}
ENV GOOGLE_ACCOUNT_1_EMAIL=${GOOGLE_ACCOUNT_1_EMAIL}
ENV GOOGLE_ACCOUNT_1_PASSWORD=${GOOGLE_ACCOUNT_1_PASSWORD}
ENV GOOGLE_ACCOUNT_2_EMAIL=${GOOGLE_ACCOUNT_2_EMAIL}
ENV GOOGLE_ACCOUNT_2_PASSWORD=${GOOGLE_ACCOUNT_2_PASSWORD}
ENV POT_PROVIDER_URL=${POT_PROVIDER_URL}

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
