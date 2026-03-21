# Quick Start

## 1. Start the Web UI

```bash
docker compose up -d helvetfolio-web
```

Open **http://localhost:3000**.

No pre-configuration needed. The portfolio file is created automatically on first use.

---

## 2. Connect to Actual Budget

1. Click **Settings** in the top-right corner
2. Enter your Actual Budget server URL, password, and select your budget
3. Click **Save** — the connection is tested immediately

> When Actual Budget runs on the same machine, use `http://host.docker.internal:5006` as the server URL.

---

## 3. Add Your First Stock

1. Click **Add Stock**
2. Enter the ticker (e.g. `NESN`, `NOVN`, `ROG`)
3. Enter the quantity
4. Optionally set a purchase date and price for gain/loss tracking
5. Click **Add Stock**

A new account is created in Actual Budget and the current price is fetched immediately.

---

## Common Commands

```bash
# Start web UI
docker compose up -d helvetfolio-web

# Stop
docker compose down

# View logs
docker compose logs -f helvetfolio-web

# CLI commands
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
