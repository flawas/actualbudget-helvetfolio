<div align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="Helvetfolio logo"><br><br>

  # Helvetfolio

  **Track your stock portfolio and keep it in sync with [Actual Budget](https://actualbudget.org) automatically.**

  Prices are fetched from Yahoo Finance and written to a dedicated Actual Budget account per holding — on a schedule, via the web UI, or from the command line.

  <br>

  [![Docker Hub](https://img.shields.io/docker/v/flawas/helvetfolio?label=Docker%20Hub&logo=docker&logoColor=white&color=2496ED)](https://hub.docker.com/r/flawas/helvetfolio)
  [![GHCR](https://img.shields.io/badge/GHCR-flawas%2Fhelvetfolio-blue?logo=github&logoColor=white)](https://ghcr.io/flawas/helvetfolio)
  [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=flawas_actualbudget-helvetfolio&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=flawas_actualbudget-helvetfolio)
  [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=flawas_actualbudget-helvetfolio&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=flawas_actualbudget-helvetfolio)
  [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=flawas_actualbudget-helvetfolio&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=flawas_actualbudget-helvetfolio)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

  <br>

  [Quick Start](#-quick-start) · [Features](#-features) · [Configuration](#-configuration) · [Docs](WEB_GUI.md) · [Docker](DOCKER.md)

</div>

---

## ✨ Features

<table>
<tr>
<td>

**📊 Live Portfolio Dashboard**<br>
Responsive table with total value, gain/loss, and per-holding badges. Inline editing — click any cell to edit in place.

</td>
<td>

**🏷️ Stock Grouping**<br>
Organise holdings into named groups. Groups show aggregate value and gain/loss, collapse/expand on click.

</td>
</tr>
<tr>
<td>

**📈 Automatic Price Sync**<br>
Yahoo Finance prices pushed to Actual Budget on demand or on a schedule via the background daemon.

</td>
<td>

**🔒 Password Protection**<br>
Optional web UI password set through the Settings modal or via environment variable. Styled login modal, no browser dialogs.

</td>
</tr>
<tr>
<td>

**⚙️ Zero-Config Start**<br>
No configuration file required. Enter connection settings through the web UI — persisted automatically to `./data`.

</td>
<td>

**🖥️ Three Run Modes**<br>
Web UI, background daemon, or one-shot CLI — all from the same Docker image via `MODE=`.

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Docker Compose (recommended)

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000** and configure your Actual Budget connection in **Settings**.

### docker run

```bash
docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MODE=web \
  ghcr.io/flawas/helvetfolio:latest
```

### Docker Desktop

1. Pull `ghcr.io/flawas/helvetfolio:latest`
2. **Images → Run → Optional settings**
   - Port: `3000` → `3000`
   - Volume: `./data` → `/app/data`
   - Env: `MODE` = `web`
3. Click **Run**, then open **http://localhost:3000**

> [!TIP]
> When Actual Budget is running on the same machine, use `http://host.docker.internal:5006` as the server URL.

---

## 🐳 Docker Images

| Image | Registry | Arch |
|---|---|---|
| `flawas/helvetfolio:latest` | [Docker Hub](https://hub.docker.com/r/flawas/helvetfolio) | `amd64` · `arm64` |
| `ghcr.io/flawas/helvetfolio:latest` | [GitHub Container Registry](https://ghcr.io/flawas/helvetfolio) | `amd64` · `arm64` |

Both registries are updated on every release.

---

## 🎛️ Start Modes

| `MODE` | What runs | Use case |
|---|---|---|
| `web` *(recommended)* | Web UI on port 3000 | Always-on dashboard |
| `daemon` | Background price sync | Scheduled updates without the UI |
| `cli` *(default)* | One-shot CLI command | Manual operations |

---

## 🖥️ CLI Commands

```bash
# With Docker Compose
docker compose run --rm helvetfolio <command>

# With docker run
docker run --rm -v $(pwd)/data:/app/data ghcr.io/flawas/helvetfolio:latest <command>
```

| Command | Description |
|---|---|
| `list` | List all stocks |
| `add <ticker> <qty>` | Add a stock |
| `remove <ticker>` | Remove a stock |
| `set-quantity <ticker> <qty>` | Update share count |
| `update` | Fetch latest prices and sync to Actual Budget |
| `performance` | Show gains / losses |
| `start-daemon` | Run continuous background sync |

---

## ⚙️ Configuration

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
| `WEB_PASSWORD` | — | Enables password protection on the web UI |

> [!NOTE]
> All data (portfolio, settings, Actual Budget cache) is stored in the single `./data` directory. No pre-configuration needed — the portfolio file is created automatically on first use.

---

## 📚 Docs

| Guide | Description |
|---|---|
| [Web UI Guide](WEB_GUI.md) | Features, adding stocks, password protection, API reference |
| [Docker Deployment](DOCKER.md) | All run modes, volumes, networking, troubleshooting |
| [Quick Start](QUICK_START.md) | Step-by-step getting started guide |
| [Swiss Stock Tickers](SWISS_STOCKS.md) | Ticker reference for SIX Swiss Exchange |

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/flawas">Flavio</a>
</div>
