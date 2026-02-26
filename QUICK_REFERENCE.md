# Quick Reference: Helvetfolio Commands

## Basic Commands

### Add Stock

```bash
# Current price
npm start add NESN 100

# Historical purchase (e.g., from 2020)
npm start add NESN 100 --date 2020-03-15 --price 95.00
```

### View Portfolio

```bash
npm start list
```

### View Performance (Gains/Losses)

```bash
npm start performance
```

### Update Prices

```bash
npm start update
```

### Remove Stock

```bash
npm start remove NESN
```

### Update Quantity

```bash
npm start set-quantity NESN 150
```

### Run Daemon (Auto-updates)

```bash
npm run daemon
```

## Docker Commands

Just prefix with `docker-compose run --rm helvetfolio`:

```bash
# Add stock
docker-compose run --rm helvetfolio add NESN 100 --date 2020-03-15 --price 95.00

# View performance
docker-compose run --rm helvetfolio performance

# Update prices
docker-compose run --rm helvetfolio update

# Start daemon
docker-compose up -d helvetfolio-daemon
```

## Common Swiss Stocks

| Stock | Ticker | Sector |
|-------|--------|--------|
| Nestlé | NESN | Consumer |
| Novartis | NOVN | Pharma |
| Roche | ROG | Pharma |
| UBS | UBSG | Bank |
| Zurich Insurance | ZURN | Insurance |
| ABB | ABBN | Industrial |

## Configuration

Edit `.env`:

```env
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=your-password
ACTUAL_BUDGET_ID=your-budget-id
UPDATE_INTERVAL_MINUTES=60
```

## Files

- `portfolio.json` - Your stock holdings
- `data/` - Actual Budget local data
- `.env` - Configuration

## Help

```bash
npm start --help
npm start add --help
```
