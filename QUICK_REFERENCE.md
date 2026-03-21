# Quick Reference

## Docker Compose

```bash
# Start web UI
docker compose up -d helvetfolio-web

# Start daemon (background sync)
docker compose up -d helvetfolio-daemon

# Stop everything
docker compose down

# View logs
docker compose logs -f helvetfolio-web
```

## CLI via Docker

```bash
docker compose run --rm helvetfolio list
docker compose run --rm helvetfolio performance
docker compose run --rm helvetfolio update
docker compose run --rm helvetfolio add NESN 100
docker compose run --rm helvetfolio add NESN 100 --date 2020-03-15 --price 95.00
docker compose run --rm helvetfolio remove NESN
docker compose run --rm helvetfolio set-quantity NESN 150
```

## CLI via npm (local dev)

```bash
npm start list
npm start performance
npm start update
npm start -- add NESN 100 --date 2020-03-15 --price 95.00
npm start -- remove NESN
npm start -- set-quantity NESN 150
npm run daemon
npm run web
```

## Building Locally

```bash
docker build -t helvetfolio:local .
docker run -d -p 3000:3000 -e MODE=web helvetfolio:local
docker run --rm helvetfolio:local list
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MODE` | `cli` | `web`, `daemon`, or `cli` |
| `ACTUAL_SERVER_URL` | — | Actual Budget server URL |
| `ACTUAL_PASSWORD` | — | Actual Budget password |
| `ACTUAL_BUDGET_ID` | — | Budget ID |
| `UPDATE_INTERVAL_MINUTES` | `60` | Daemon sync interval |
| `WEB_PORT` | `3000` | Web UI port |
| `WEB_PASSWORD` | — | HTTP Basic Auth password |
| `STOCK_EXCHANGE_SUFFIX` | `.SW` | Ticker suffix |

## Common Swiss Stocks

| Stock | Ticker | Sector |
|---|---|---|
| Nestlé | NESN | Consumer |
| Novartis | NOVN | Pharma |
| Roche | ROG | Pharma |
| UBS | UBSG | Bank |
| Zurich Insurance | ZURN | Insurance |
| ABB | ABBN | Industrial |
