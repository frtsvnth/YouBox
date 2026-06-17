FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    python3 \
    pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --break-system-packages --no-cache-dir yt-dlp

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

RUN mkdir -p /browser-profile /browser-exports && \
    chmod 700 /browser-profile /browser-exports

RUN useradd -m -u 1001 youbox && \
    chown -R youbox:youbox /app /browser-profile /browser-exports

USER youbox

ENV PORT=3808
ENV BROWSER_PORT=3809
ENV PROFILE_DIR=/browser-profile
ENV EXPORT_DIR=/browser-exports

EXPOSE 3808 3809

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '3808') + '/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
