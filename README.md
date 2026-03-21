# Helvetfolio

Track your stock portfolio and keep it in sync with [Actual Budget](https://actualbudget.org) automatically.

Prices are fetched from Yahoo Finance and written to a dedicated Actual Budget account per holding — on a schedule, or on demand via the web UI.

[![Docker Hub](https://img.shields.io/docker/v/flawas/helvetfolio?label=Docker%20Hub)](https://hub.docker.com/r/flawas/helvetfolio)
[![GHCR](https://img.shields.io/badge/ghcr.io-flawas%2Fhelvetfolio-blue)](https://ghcr.io/flawas/helvetfolio)

---

## Quick start

No configuration file required. Connection settings are configured through the web UI and persisted to the `./data` directory.

### With Docker Compose (recommended)

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000** and configure your Actual Budget connection in **Settings**.

### With docker run

```bash
docker pull ghcr.io/flawas/helvetfolio:latest

docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MODE=web \
  ghcr.io/flawas/helvetfolio:latest
```

Open **http://localhost:3000** in your browser.

### With Docker Desktop GUI

1. Pull `ghcr.io/flawas/helvetfolio:latest`
2. **Images** → find the image → **Run**
3. Expand **Optional settings**:
   - **Ports**: `3000` → `3000`
   - **Volumes**: host path `./data` → container path `/app/data`
   - **Environment variables**: `MODE` = `web`
4. Click **Run**

---

## Docker images

| Image | Registry |
|---|---|
| `flawas/helvetfolio:latest` | [Docker Hub](https://hub.docker.com/r/flawas/helvetfolio) |
| `ghcr.io/flawas/helvetfolio:latest` | [GitHub Container Registry](https://ghcr.io/flawas/helvetfolio) |

Both registries are updated on every release. Multi-arch: `linux/amd64` + `linux/arm64`.

---

## Compose files

| File | Use case |
|---|---|
| `docker-compose.yml` | **Published images** — pull and run, no build step |
| `docker-compose.dev.yml` | **Build from source** — for local development |

```bash
# End users — published images
docker compose up -d helvetfolio-web

# Developers — build from source
docker compose -f docker-compose.dev.yml up -d helvetfolio-web
```

---

## Start modes

The image is controlled via the `MODE` environment variable:

| `MODE` | What runs | Use case |
|---|---|---|
| `web` (recommended) | Web UI on port 3000 | Always-on dashboard |
| `daemon` | Background price sync | Scheduled updates without the UI |
| `cli` (default) | One-shot CLI command | Manual operations |

---

## CLI commands

```bash
# With Docker Compose
docker compose run --rm helvetfolio <command>

# With docker run (no volume = ephemeral; add -v $(pwd)/data:/app/data to persist)
docker run --rm ghcr.io/flawas/helvetfolio:latest <command>
```

| Command | Description |
|---|---|
| `list` | List all stocks |
| `add <ticker> <qty>` | Add a stock |
| `remove <ticker>` | Remove a stock |
| `set-quantity <ticker> <qty>` | Update share count |
| `update` | Fetch latest prices and sync to Actual Budget |
| `performance` | Show gains/losses |
| `start-daemon` | Run continuous background sync |

---

## Configuration

All connection settings can be configured from the **Settings** modal in the web UI — no restart required.

Environment variables can also be used to pre-configure or override settings:

| Variable | Default | Description |
|---|---|---|
| `MODE` | `cli` | Start mode: `web`, `daemon`, or `cli` |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget server password |
| `ACTUAL_BUDGET_ID` | — | Budget ID (Settings → Advanced) |
| `ACTUAL_DATA_DIR` | `/app/data` | Local cache directory |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Exchange suffix for tickers (`.SW`, `.DE`, `.L`, …) |
| `UPDATE_INTERVAL_MINUTES` | `60` | Sync interval in daemon mode |
| `PORTFOLIO_FILE` | `/app/data/portfolio.json` | Portfolio data file |
| `WEB_PORT` | `3000` | Web UI port |
| `WEB_PASSWORD` | — | Enables HTTP Basic Auth on the web UI |

All data (portfolio, connection settings, Actual Budget cache) is stored in the single `./data` directory. No pre-configuration needed — the portfolio file is created automatically on first use.

---

## Web UI features

- Portfolio table with total value and gain/loss summary
- Inline editing — click Qty, Purchase Date or Buy Price to edit in-place
- Separate sync timestamps for Yahoo Finance and Actual Budget
- Responsive layout (no horizontal scroll)
- Optional password protection (HTTP Basic Auth)

---

## Building locally

```bash
# Build image
docker build -t helvetfolio:local .

# Run web UI
docker run -d -p 3000:3000 -e MODE=web helvetfolio:local

# Run CLI
docker run --rm helvetfolio:local list
```

---

## Docs

- [Web UI guide](WEB_GUI.md)
- [Docker deployment](DOCKER.md)
- [Stock ticker reference](SWISS_STOCKS.md)

---

## License

MIT
