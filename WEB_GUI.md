# Web UI Guide

Portfolio dashboard for managing your holdings and syncing with Actual Budget.

---

## Installation

### Docker (recommended)

```bash
docker pull flawas/helvetfolio:latest
# or: docker pull ghcr.io/flawas/helvetfolio:latest

docker run -d \
  --name helvetfolio-web \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/portfolio.json:/app/portfolio.json \
  --entrypoint node \
  flawas/helvetfolio:latest /app/src/web-server.js
```

### Docker Compose

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000** in your browser.

---

## Features

### Portfolio table

- All holdings in a single responsive table
- Inline editing — click **Qty**, **Purchase Date**, or **Buy Price** to edit in-place; press Enter to save, Escape to cancel
- Gain/loss badge per row (green/red)
- Summary bar: total value, total gain/loss, total positions

### Sync status

Two timestamps are shown below the summary:

- **Yahoo Finance** — when prices were last fetched
- **Actual Budget** — when balances were last written

### Price sync

Click **Update Prices** to fetch the latest prices from Yahoo Finance and push updated balances to Actual Budget.

### Settings

Click **Settings** to configure:

- Actual Budget server URL, password, and budget selection
- Web UI password (HTTP Basic Auth)

No restart required — settings take effect immediately.

---

## Password protection

To restrict access to the web UI, set a password in the Settings modal or via environment variable:

```env
WEB_PASSWORD=your-secret
```

The `WEB_PASSWORD` env var takes precedence over the UI setting. When set, all requests require HTTP Basic Auth.

---

## Adding stocks

1. Click **Add Stock**
2. Enter the ticker (e.g. `NESN`, `NOVN`, `ROG`) — the exchange suffix is added automatically
3. Enter quantity
4. Optionally set a purchase date and price for gain/loss tracking
5. Click **Add Stock**

A new account is created in Actual Budget and the current price is fetched immediately.

---

## Accessing from other devices

Find your host IP and open `http://<IP>:3000` from any device on the same network. Enable the web password to restrict access.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `WEB_PORT` | `3000` | Listening port |
| `WEB_PASSWORD` | — | HTTP Basic Auth password |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget password |
| `ACTUAL_BUDGET_ID` | — | Budget ID |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Ticker suffix (`.SW`, `.DE`, `.L`, …) |

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/performance` | Portfolio with gain/loss metrics |
| `GET` | `/api/portfolio` | Portfolio summary (no Actual Budget needed) |
| `POST` | `/api/stocks` | Add a stock |
| `DELETE` | `/api/stocks/:ticker` | Remove a stock |
| `PUT` | `/api/stocks/:ticker/quantity` | Update quantity |
| `PATCH` | `/api/stocks/:ticker` | Update purchase date / price |
| `POST` | `/api/update-prices` | Fetch prices and sync to Actual Budget |
| `GET` | `/api/connection` | Get current connection settings |
| `POST` | `/api/connection` | Update connection settings |
| `DELETE` | `/api/connection` | Reset connection settings to env defaults |
| `GET` | `/api/budgets` | List available budgets on the Actual server |

---

## Troubleshooting

**Can't connect to Actual Budget**
- Verify Actual Budget is running and reachable
- When running in Docker, use `host.docker.internal` instead of `localhost` in the server URL
- Check the server URL and password in Settings

**Port already in use**
```bash
# Use a different port
WEB_PORT=3001 docker compose up -d helvetfolio-web
```

**Prices not updating**
- Click Update Prices and check the toast notification for errors
- Verify the ticker is valid on Yahoo Finance
