<div align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="Helvetfolio logo"><br><br>

  # Web UI Guide

  Portfolio dashboard for managing your holdings and syncing with Actual Budget.

  [← Back to README](README.md)
</div>

---

## Starting the Web UI

<details>
<summary><strong>Docker Compose</strong></summary>

```bash
docker compose up -d helvetfolio-web
```

</details>

<details>
<summary><strong>docker run</strong></summary>

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
<summary><strong>Docker Desktop GUI</strong></summary>

1. Pull or build the image
2. **Images → Run → Optional settings**
   - Port: `3000` → `3000`
   - Volume: `./data` → `/app/data`
   - Env: `MODE` = `web`
3. Click **Run**

</details>

Open **http://localhost:3000** in your browser.

---

## Features

### 📊 Portfolio Table

- All holdings in a single responsive table
- Inline editing — click **Qty**, **Purchase Date**, or **Buy Price** to edit in-place; press `Enter` to save, `Escape` to cancel
- Gain/loss badge per row (green / red)
- Summary cards: total value, total gain/loss, total positions

### 🏷️ Stock Grouping

Organise holdings into named groups directly from the portfolio table.

| Action | How |
|---|---|
| Create a group | Click the tag icon on any stock row → **Create new group…** |
| Assign a stock | Click the tag icon → select a group |
| Rename a group | Double-click the group header |
| Delete a group | Hover the group header → click **✕** |
| Collapse / expand | Click anywhere on the group header row |

Groups display aggregate value and gain/loss. Multiple positions of the same ticker are independently assignable because grouping is keyed on the Actual Budget account ID.

### 🔃 Column Sorting

Click any column header to sort ascending or descending. An arrow indicator shows the active sort direction.

### 🕐 Sync Status

Two timestamps are shown below the summary:

- **Yahoo Finance** — when prices were last fetched
- **Actual Budget** — when balances were last written

### 🔄 Price Sync

Click **Update Prices** to fetch the latest prices from Yahoo Finance and push updated balances to Actual Budget.

### ⚙️ Settings

Click **Settings** to configure:

- Actual Budget server URL, password, and budget
- Web UI password

No restart required — settings take effect immediately and are persisted to `./data`.

---

## Adding Stocks

1. Click **Add Stock** *(disabled until a valid Actual Budget connection is configured)*
2. Enter the ticker symbol — e.g. `NESN`, `NOVN`, `ROG` — the exchange suffix is added automatically
3. Enter the quantity
4. Optionally set a purchase date and price for gain/loss tracking
5. Click **Add Stock**

A new account is created in Actual Budget and the current price is fetched immediately.

> [!TIP]
> The default exchange suffix is `.SW` (SIX Swiss Exchange). Change it via `STOCK_EXCHANGE_SUFFIX` to track stocks on other exchanges (`.DE`, `.L`, etc.).

---

## Password Protection

Set a password in **Settings → Web Password** or via environment variable:

```env
WEB_PASSWORD=your-secret
```

> [!NOTE]
> `WEB_PASSWORD` via environment variable takes precedence over the UI setting. When a password is configured, a branded login modal is shown — the browser's native auth dialog is never used.

Credentials are stored in `sessionStorage` for the duration of the tab session.

---

## Accessing from Other Devices

Find your host IP and open `http://<IP>:3000` from any device on the same network.

> [!WARNING]
> Enable the web password before exposing the UI on a shared network.

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `MODE` | `cli` | Set to `web` to start the web server |
| `WEB_PORT` | `3000` | Listening port |
| `WEB_PASSWORD` | — | HTTP Basic Auth password |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget password |
| `ACTUAL_BUDGET_ID` | — | Budget ID |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Ticker suffix (`.SW`, `.DE`, `.L`, …) |

---

## API Reference

All endpoints return JSON. When a web password is configured, include `Authorization: Basic base64(:password)`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/performance` | Portfolio with gain/loss metrics |
| `GET` | `/api/portfolio` | Portfolio summary (no Actual Budget needed) |
| `POST` | `/api/stocks` | Add a stock |
| `DELETE` | `/api/stocks/:ticker` | Remove a stock |
| `PUT` | `/api/stocks/:ticker/quantity` | Update quantity |
| `PATCH` | `/api/stocks/:ticker` | Update purchase date / price |
| `PATCH` | `/api/stocks/by-account/:accountId/group` | Assign stock to a group |
| `POST` | `/api/groups` | Create a group |
| `PATCH` | `/api/groups/:id` | Rename a group |
| `DELETE` | `/api/groups/:id` | Delete a group |
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
WEB_PORT=3001 docker compose up -d helvetfolio-web
```

**Prices not updating**

- Click Update Prices and check the notification for errors
- Verify the ticker is valid on Yahoo Finance (try searching it at finance.yahoo.com)
