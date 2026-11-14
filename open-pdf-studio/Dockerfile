# Dockerfile — Open PDF Studio web-unit static host (Caddy passthrough)
#
# Multi-stage build:
#   1. builder: Node 24 — installs deps and runs `npm run build:web-unit`
#   2. runner: Caddy 2 — serves dist-web-unit/ as static files
#
# Build:  docker build -t plutonium/open-pdf-studio-web:2026.46.3 .
# Run:    docker run -p 8080:80 plutonium/open-pdf-studio-web:2026.46.3
#
# The bundle is served at the root (/). The plutonium cloud portal embeds it
# in an iframe at plutoniumcloud.com/desktop and drives it via postMessage
# (see open-pdf-studio/web-unit/src/iframe-brug.js).
#
# NOTE: Docker is not available in this sandbox; this file is authored for
# the next agent to build and test in an environment with Docker.

# ---------------- Stage 1: build the web-unit bundle ----------------
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching).
COPY open-pdf-studio/package.json open-pdf-studio/package-lock.json ./
RUN npm ci

# Copy the rest of the app source.
COPY open-pdf-studio/ ./

# Build the embeddable web unit (Vite, vite.web-unit.config.js).
# No Rust/C toolchain required — this is a web-only build.
RUN npm run build:web-unit

# ---------------- Stage 2: serve with Caddy ----------------
FROM caddy:2-alpine AS runner

WORKDIR /usr/share/caddy

# Copy the pre-built web-unit bundle.
COPY --from=builder /app/dist-web-unit ./dist-web-unit

# Caddy configuration.
COPY open-pdf-studio/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

# Caddy runs as its own non-root user by default (caddy:caddy).
ENTRYPOINT ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
