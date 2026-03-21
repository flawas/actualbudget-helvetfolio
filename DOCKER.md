# Docker Deployment Guide

## Quick Start

### Web UI (recommended)

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000**. No pre-configuration needed — connection settings are saved through the web UI.

### Docker Desktop GUI

1. Pull `ghcr.io/flawas/helvetfolio:latest` or build locally (`docker build -t helvetfolio:local .`)
2. **Images** → find the image → **Run**
3. Expand **Optional settings**:
   - **Ports**: `3000` → `3000`
   - **Volumes**: host path `./data` → container path `/app/data`
   - **Environment variables**: `MODE` = `web`
4. Click **Run**

---

## Start Modes

The image behaviour is controlled by the `MODE` environment variable:

| `MODE` | What runs | Command |
|---|---|---|
| `web` | Web UI on `:3000` | `docker run -e MODE=web ...` |
| `daemon` | Background price sync | `docker run -e MODE=daemon ...` |
| `cli` (default) | One-shot CLI | `docker run ... list` |

---

## Running with docker run

### Web UI

```bash
docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MODE=web \
  ghcr.io/flawas/helvetfolio:latest
```

### Daemon

```bash
docker run -d \
  --name helvetfolio-daemon \
  -v $(pwd)/data:/app/data \
  -e MODE=daemon \
  -e UPDATE_INTERVAL_MINUTES=60 \
  --restart unless-stopped \
  ghcr.io/flawas/helvetfolio:latest
```

### CLI (one-shot)

```bash
# No volume = ephemeral (data lost on stop)
docker run --rm ghcr.io/flawas/helvetfolio:latest list

# With persistent data
docker run --rm \
  -v $(pwd)/data:/app/data \
  ghcr.io/flawas/helvetfolio:latest add NESN 100
```

---

## Running with Docker Compose

```bash
# Web UI
docker compose up -d helvetfolio-web

# Daemon
docker compose up -d helvetfolio-daemon

# One-shot CLI
docker compose run --rm helvetfolio list
docker compose run --rm helvetfolio add NESN 100
docker compose run --rm helvetfolio performance
```

---

## Building Locally

```bash
docker build -t helvetfolio:local .
```

The Dockerfile uses a multi-stage build — build tools (`g++`, `make`, `python3`) are stripped from the final image, keeping it at ~235 MB.

To use the locally built image with compose:

```bash
docker compose -f docker-compose.dev.yml up -d helvetfolio-web
```

---

## Data & Volumes

All data lives in a single directory:

| Host path | Container path | Contents |
|---|---|---|
| `./data` | `/app/data` | Portfolio file, Actual Budget cache, settings |

The portfolio file (`/app/data/portfolio.json`) is created automatically on first write. No pre-setup required — you can run the container with no volume and it will start with an empty in-memory portfolio.

### Backup

```bash
# Portfolio + settings
cp -r data/ data-backup-$(date +%Y%m%d)/

# Or just the portfolio file
cp data/portfolio.json portfolio.backup.json
```

---

## Configuration

Connection settings are saved through the **Settings** modal in the web UI. Environment variables can be used to pre-configure or override:

| Variable | Default | Description |
|---|---|---|
| `MODE` | `cli` | Start mode: `web`, `daemon`, `cli` |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget password |
| `ACTUAL_BUDGET_ID` | — | Budget ID |
| `UPDATE_INTERVAL_MINUTES` | `60` | Daemon sync interval |
| `WEB_PORT` | `3000` | Web UI port |
| `WEB_PASSWORD` | — | HTTP Basic Auth password |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Ticker suffix (`.SW`, `.DE`, `.L`, …) |

---

## Networking

### Connecting to Actual Budget on the host machine

```
ACTUAL_SERVER_URL=http://host.docker.internal:5006
```

### Connecting to Actual Budget in another container

```yaml
# docker-compose.yml — share the same network
networks:
  - budget-network
```

```
ACTUAL_SERVER_URL=http://actual-budget:5006
```

---

## Troubleshooting

### Container exits immediately

Check the MODE. The default (`cli`) runs `list` and exits — that is expected behaviour for a CLI command. Use `MODE=web` or `MODE=daemon` for long-running services.

### Can't connect to Actual Budget

- Use `host.docker.internal` instead of `localhost` when Actual Budget runs on the host
- Verify Actual Budget is running: `curl http://localhost:5006`

### Port already in use

```bash
WEB_PORT=3001 docker compose up -d helvetfolio-web
```

### View logs

```bash
docker compose logs -f helvetfolio-web
docker logs helvetfolio-web
```
