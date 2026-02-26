# Helvetfolio - Complete Setup Guide

## 🚀 Quick Start (Everything in Docker)

### 1. Start All Services

```bash
cd /Users/flaviowaser/Github/actual-swissmarket-extension
docker-compose up -d
```

This starts:

- **Actual Budget Server** (port 5006)
- **Helvetfolio Web UI** (port 3000)

### 2. Access the Applications

- **Actual Budget**: <http://localhost:5006>
- **Stock Manager**: <http://localhost:3000>

### 3. First-Time Setup

1. Open Actual Budget at <http://localhost:5006>
2. Create a new budget or import existing
3. Note your Budget ID (Settings > Advanced)
4. Update `.env` file with your Budget ID:

   ```bash
   cp .env.example .env
   nano .env
   ```

   Set `ACTUAL_BUDGET_ID=your-budget-id`

5. Restart stock manager:

   ```bash
   docker-compose restart helvetfolio-web
   ```

### 4. Add Your First Stock

Open <http://localhost:3000> and click "Add Stock"!

## 📋 Available Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Actual Budget | 5006 | <http://localhost:5006> | Budget app |
| Stock Manager GUI | 3000 | <http://localhost:3000> | Manage stocks |
| CLI Commands | - | - | `docker-compose run --rm helvetfolio ...` |
| Auto-update Daemon | - | - | Uncomment in docker-compose.yml |

## 🎯 Common Commands

### Using the Web GUI

```bash
# Just open your browser
http://localhost:3000
```

### Using CLI

```bash
# Add stock from 2020
docker-compose run --rm helvetfolio add NESN 100 --date 2020-03-15 --price 95.00

# View portfolio
docker-compose run --rm helvetfolio list

# View performance
docker-compose run --rm helvetfolio performance

# Update prices
docker-compose run --rm helvetfolio update
```

### Managing Services

```bash
# Start all
docker-compose up -d

# Stop all
docker-compose down

# View logs
docker-compose logs -f helvetfolio-web

# Restart a service
docker-compose restart helvetfolio-web

# Rebuild after code changes
docker-compose build && docker-compose up -d
```

## 🔧 Troubleshooting

### Web GUI not loading

```bash
docker-compose logs helvetfolio-web
```

### Can't connect to Actual Budget

1. Make sure Actual Budget is running: <http://localhost:5006>
2. Check docker logs: `docker-compose logs actual-server`

### Rebuild everything

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📁 Data Persistence

Your data is stored in:

- `portfolio.json` - Your stock holdings
- `actual-data` volume - Actual Budget data

To backup:

```bash
cp portfolio.json backup-$(date +%Y%m%d).json
docker run --rm -v actual-swissmarket-extension_actual-data:/data -v $(pwd):/backup alpine tar czf /backup/actual-data-backup.tar.gz /data
```

## 🎨 Features

✅ Track Swiss stocks with purchase history
✅ Calculate gains/losses automatically  
✅ Beautiful web interface
✅ CLI for advanced users
✅ Auto-updates with daemon mode
✅ Everything in Docker - no local setup needed

Enjoy tracking your Swiss investments!
