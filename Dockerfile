# ── Stage 1: build native addons ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache g++ make python3

COPY package*.json ./
RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy only production node_modules from builder (no build tools in final image)
COPY --from=builder /app/node_modules ./node_modules

COPY src/ ./src/
COPY public/ ./public/
COPY docker-entrypoint.sh ./

RUN mkdir -p /app/data \
    && chown -R node:node /app/data \
    && chmod +x /app/src/index.js /app/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production \
    ACTUAL_DATA_DIR=/app/data \
    PORTFOLIO_FILE=/app/data/portfolio.json \
    MODE=cli

USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["list"]
