<div align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="Helvetfolio logo"><br><br>

  # Quick Start

  Get Helvetfolio running in under 2 minutes.

  [← Back to README](README.md)
</div>

---

## Step 1 — Start the Web UI

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000**.

No pre-configuration needed — the portfolio file is created automatically on first use.

---

## Step 2 — Connect to Actual Budget

1. Click **Settings** in the top-right corner
2. Enter your **Actual Budget server URL**, **password**, and select your **budget**
3. Click **Save** — the connection is tested immediately

> [!TIP]
> When Actual Budget is running on the same machine as Docker, use `http://host.docker.internal:5006` as the server URL.

---

## Step 3 — Add Your First Stock

1. Click **Add Stock** *(enabled once a valid connection is saved)*
2. Enter the ticker symbol — e.g. `NESN`, `NOVN`, `ROG`
3. Enter the quantity
4. Optionally set a **purchase date** and **price** for gain/loss tracking
5. Click **Add Stock**

A new account is created in Actual Budget and the current price is fetched immediately.

> [!NOTE]
> The default exchange suffix is `.SW` (SIX Swiss Exchange). To track stocks on other exchanges, set `STOCK_EXCHANGE_SUFFIX=.DE` (Xetra), `.L` (London), etc.

---

## Common Commands

```bash
# Start web UI
docker compose up -d helvetfolio-web

# Stop
docker compose down

# View logs
docker compose logs -f helvetfolio-web

# CLI — list, sync, add
docker compose run --rm helvetfolio list
docker compose run --rm helvetfolio performance
docker compose run --rm helvetfolio update
docker compose run --rm helvetfolio add NESN 100

# Start background sync daemon
docker compose up -d helvetfolio-daemon
```

---

## Without Docker Compose

```bash
# Web UI
docker run -d -p 3000:3000 -e MODE=web \
  -v $(pwd)/data:/app/data \
  ghcr.io/flawas/helvetfolio:latest

# CLI
docker run --rm ghcr.io/flawas/helvetfolio:latest list
```

---

## Next Steps

| Guide | Description |
|---|---|
| [Web UI Guide](WEB_GUI.md) | Full feature reference, grouping, password protection, API |
| [Docker Deployment](DOCKER.md) | All run modes, networking, troubleshooting |
| [Swiss Stock Tickers](SWISS_STOCKS.md) | Ticker reference for SIX Swiss Exchange |
