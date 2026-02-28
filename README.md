# Helvetfolio

Track your stock portfolio and keep it in sync with [Actual Budget](https://actualbudget.org) automatically.

Prices are fetched from Yahoo Finance and written to a dedicated Actual Budget account per holding — on a schedule, or on demand via the web UI.

[![Docker Hub](https://img.shields.io/docker/v/flawas/helvetfolio?label=Docker%20Hub)](https://hub.docker.com/r/flawas/helvetfolio)
[![GHCR](https://img.shields.io/badge/ghcr.io-flawas%2Fhelvetfolio-blue)](https://ghcr.io/flawas/helvetfolio)

---

## Quick start

No configuration required to start. Connection settings are configured through the web UI and persisted to the `./data` directory.

### With Docker Compose (recommended)

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000** and configure your Actual Budget connection in **Settings**.

### With Docker run

```bash
docker pull flawas/helvetfolio:latest
# or: docker pull ghcr.io/flawas/helvetfolio:latest

docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e PORTFOLIO_FILE=/app/data/portfolio.json \
  -e ACTUAL_DATA_DIR=/app/data \
  --entrypoint node \
  flawas/helvetfolio:latest /app/src/web-server.js
```

Open **http://localhost:3000** in your browser.

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

## Services

Three entry points are available from the same image:

| Service | Description | Command |
|---|---|---|
| **Web UI** | Portfolio dashboard at `:3000` | `node /app/src/web-server.js` |
| **Daemon** | Background price sync (cron) | `helvetfolio start-daemon` |
| **CLI** | One-shot commands | `helvetfolio <command>` |

### CLI commands

```bash
# With Docker Compose
docker compose run --rm helvetfolio <command>

# With docker run
docker run --rm \
  -v $(pwd)/data:/app/data \
  -e PORTFOLIO_FILE=/app/data/portfolio.json \
  -e ACTUAL_DATA_DIR=/app/data \
  flawas/helvetfolio:latest <command>
```

| Command | Description |
|---|---|
| `add <ticker> <qty>` | Add a stock to the portfolio |
| `remove <ticker>` | Remove a stock |
| `update-quantity <ticker> <qty>` | Update share count |
| `update-prices` | Fetch latest prices and sync to Actual Budget |
| `list` | List all stocks |
| `performance` | Show gains/losses |
| `start-daemon` | Run continuous background sync |

---

## Configuration

All connection settings can be configured from the **Settings** modal in the web UI — no restart required.

Environment variables can also be used to pre-configure or override settings:

| Variable | Default | Description |
|---|---|---|
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget server password |
| `ACTUAL_BUDGET_ID` | — | Budget ID (Settings → Advanced) |
| `ACTUAL_DATA_DIR` | `./data` | Local cache directory |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Exchange suffix for tickers (`.SW`, `.DE`, `.L`, …) |
| `UPDATE_INTERVAL_MINUTES` | `60` | Sync interval in daemon mode |
| `PORTFOLIO_FILE` | `./data/portfolio.json` | Portfolio data file |
| `WEB_PORT` | `3000` | Web UI port |
| `WEB_PASSWORD` | — | Enables HTTP Basic Auth on the web UI |

All data (portfolio, connection settings, Actual Budget cache) is stored in the single `./data` directory.

---

## Web UI features

- Portfolio table with total value and gain/loss summary
- Inline editing — click Qty, Purchase Date or Buy Price to edit in-place
- Separate sync timestamps for Yahoo Finance and Actual Budget
- Responsive layout (no horizontal scroll)
- Optional password protection (HTTP Basic Auth)

---

## Docs

- [Web UI guide](WEB_GUI.md)
- [Stock ticker reference](SWISS_STOCKS.md)

---

## License

MIT
