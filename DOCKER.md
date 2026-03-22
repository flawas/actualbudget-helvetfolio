<div align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="Helvetfolio logo"><br><br>

  # Docker Deployment Guide

  [← Back to README](README.md)
</div>

---

## Quick Start

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000** — no pre-configuration needed. Connection settings are saved through the web UI.

> [!TIP]
> When Actual Budget is running on the same machine, use `http://host.docker.internal:5006` as the server URL in Settings.

---

## Start Modes

The image behaviour is controlled by the `MODE` environment variable:

| `MODE` | What runs | Use case |
|---|---|---|
| `web` *(recommended)* | Web UI on `:3000` | Always-on dashboard |
| `daemon` | Background price sync | Scheduled updates without the UI |
| `cli` *(default)* | One-shot CLI command | Manual operations |

---

## Running with docker run

<details>
<summary><strong>Web UI</strong></summary>

```bash
docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MODE=web \
  ghcr.io/flawas/helvetfolio:latest
```

</details>

<details>
<summary><strong>Daemon (background sync)</strong></summary>

```bash
docker run -d \
  --name helvetfolio-daemon \
  -v $(pwd)/data:/app/data \
  -e MODE=daemon \
  -e UPDATE_INTERVAL_MINUTES=60 \
  --restart unless-stopped \
  ghcr.io/flawas/helvetfolio:latest
```

</details>

<details>
<summary><strong>CLI (one-shot)</strong></summary>

```bash
# No volume — ephemeral (data lost on stop)
docker run --rm ghcr.io/flawas/helvetfolio:latest list

# With persistent data
docker run --rm \
  -v $(pwd)/data:/app/data \
  ghcr.io/flawas/helvetfolio:latest add NESN 100
```

</details>

---

## Running with Docker Compose

```bash
# Web UI
docker compose up -d helvetfolio-web

# Daemon
docker compose up -d helvetfolio-daemon

# One-shot CLI commands
docker compose run --rm helvetfolio list
docker compose run --rm helvetfolio add NESN 100
docker compose run --rm helvetfolio performance
```

### Compose files

| File | Use case |
|---|---|
| `docker-compose.yml` | **Published images** — pull and run, no build step |
| `docker-compose.dev.yml` | **Build from source** — for local development |

---

## Data & Volumes

All data lives in a single directory:

| Host path | Container path | Contents |
|---|---|---|
| `./data` | `/app/data` | Portfolio file, Actual Budget cache, settings |

The portfolio file is created automatically on first write. You can run the container without a volume and it will start with an empty in-memory portfolio.

### Backup

```bash
# Portfolio + settings
cp -r data/ data-backup-$(date +%Y%m%d)/

# Just the portfolio file
cp data/portfolio.json portfolio.backup.json
```

---

## Configuration

Connection settings are saved through the **Settings** modal in the web UI. Environment variables can pre-configure or override them:

| Variable | Default | Description |
|---|---|---|
| `MODE` | `cli` | Start mode: `web`, `daemon`, `cli` |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget password |
| `ACTUAL_BUDGET_ID` | — | Budget ID |
| `UPDATE_INTERVAL_MINUTES` | `60` | Daemon sync interval (minutes) |
| `WEB_PORT` | `3000` | Web UI port |
| `WEB_PASSWORD` | — | HTTP Basic Auth password |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Ticker suffix (`.SW`, `.DE`, `.L`, …) |

---

## Networking

### Actual Budget on the host machine

```
ACTUAL_SERVER_URL=http://host.docker.internal:5006
```

### Actual Budget in another container

```yaml
# docker-compose.yml — share the same Docker network
networks:
  - budget-network
```

```
ACTUAL_SERVER_URL=http://actual-budget:5006
```

---

## Building from Source

> [!NOTE]
> End users should use the published images from Docker Hub or GHCR. These steps are only needed if you are contributing to the project.

```bash
docker build -t helvetfolio:local .
```

The Dockerfile uses a multi-stage build — build tools (`g++`, `make`, `python3`) are stripped from the final image, keeping it lean.

```bash
# Use the locally built image with compose
docker compose -f docker-compose.dev.yml up -d helvetfolio-web
```

---

## Troubleshooting

**Container exits immediately**

> [!WARNING]
> The default `MODE` is `cli`, which runs `list` and exits — this is expected for a CLI command. Use `MODE=web` or `MODE=daemon` for long-running services.

**Can't connect to Actual Budget**

- Use `host.docker.internal` instead of `localhost` when Actual Budget runs on the host
- Verify it's running: `curl http://localhost:5006`

**Port already in use**

```bash
WEB_PORT=3001 docker compose up -d helvetfolio-web
```

**View logs**

```bash
docker compose logs -f helvetfolio-web
docker logs helvetfolio-web
```
