# OUIJA CTF — production image (Express serves public/ + /api)
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source (secrets are NOT copied — pass via --env-file / compose)
COPY app.js ./
COPY public ./public
COPY src ./src

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/api/health || exit 1

CMD ["node", "app.js"]
