# Helvetfolio for Actual Budget

A Node.js extension that integrates Swiss stock market data into [Actual Budget](https://actualbudget.org), enabling automated portfolio tracking and balance updates.

## Features

- ✅ **Automatic Price Updates**: Fetch real-time Swiss stock prices from Yahoo Finance
- 📊 **Portfolio Tracking**: Track multiple Swiss stocks in investment accounts
- 📈 **Historical Tracking**: Record purchase dates and prices to calculate gains/losses
- 🔄 **Auto-Sync**: Automatically update account balances based on current market values
- 🤖 **Daemon Mode**: Run as a background service for continuous updates
- 💰 **Multi-Currency Support**: Handle CHF and other currencies
- 👨‍💻 **Web GUI**: Modern web interface for easy portfolio management
- 📱 **Simple CLI**: Easy-to-use command-line interface
- 📱 **Simple Web UI**: Easy-to-use web interface

> [!IMPORTANT]
> **Node.js Version**: This extension requires Node.js v18-v22 (LTS recommended). If you're using Node.js v23+, you may encounter native compilation issues with the `better-sqlite3` dependency. See [TROUBLESHOOTING.md](file:///Users/flaviowaser/Github/actual-swissmarket-extension/TROUBLESHOOTING.md) for solutions.

## Prerequisites

- **Node.js** v18 or higher
- **Actual Budget** instance (local or remote server)
- Your **Budget ID** (found in Settings > Advanced in Actual Budget)

## Installation

### Option 1: Docker (Recommended - No Node.js Version Issues)

Docker avoids all Node.js version compatibility issues!

```bash
# 1. Setup
cp .env.example .env
# Edit .env with your Actual Budget configuration

# 2. Initialize portfolio
echo '{"stocks":[]}' > portfolio.json

# 3. Build and run
docker-compose build
docker-compose run --rm helvetfolio add NESN 100
```

See [DOCKER.md](file:///Users/flaviowaser/Github/actual-swissmarket-extension/DOCKER.md) for complete Docker documentation.

### Option 2: Local Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd actual-swissmarket-extension
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure the extension**:

   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** with your Actual Budget configuration:

   ```env
   ACTUAL_SERVER_URL=http://localhost:5006
   ACTUAL_PASSWORD=your-password
   ACTUAL_BUDGET_ID=your-budget-id
   ACTUAL_DATA_DIR=./data
   UPDATE_INTERVAL_MINUTES=60
   PORTFOLIO_FILE=./portfolio.json
   ```

## Configuration

### Finding Your Budget ID

1. Open Actual Budget
2. Go to **Settings** (gear icon)
3. Click **Advanced**
4. Copy your **Budget ID** (sync ID)

### Server URL Options

- **Local server**: `http://localhost:5006`
- **Remote server**: `https://your-server.com`
- **No server** (local only): Leave empty

## Usage

### Web GUI (Easiest)

Start the web server:

```bash
npm run web
```

Then open your browser to `http://localhost:3000`

Features:

- Add/remove stocks with a click
- View real-time portfolio performance
- Update prices instantly
- Beautiful dark theme interface

See [WEB_GUI.md](file:///Users/flaviowaser/Github/actual-swissmarket-extension/WEB_GUI.md) for full documentation.

### Command Line Interface

### Add a Stock to Your Portfolio

```bash
# Add with current price
npm start add NESN 100

# Add with historical purchase info (e.g., bought in 2020)
npm start add NESN 100 --date 2020-03-15 --price 95.00
```

This adds shares to your portfolio and creates an investment account in Actual Budget. Use `--date` and `--price` to track historical purchases and calculate gains/losses.

See [HISTORICAL_TRACKING.md](file:///Users/flaviowaser/Github/actual-swissmarket-extension/HISTORICAL_TRACKING.md) for detailed examples.

### Remove a Stock

```bash
npm start remove NESN
```

### Update All Prices

```bash
npm start update
```

Fetches the latest prices for all stocks and updates account balances in Actual Budget.

### List Your Portfolio

```bash
npm start list
```

Displays all stocks with current values.

### View Portfolio Performance

```bash
npm start performance
```

Displays gains/losses for each stock and total portfolio performance.

### Update Stock Quantity

```bash
npm start set-quantity NESN 150
```

Updates the quantity of shares for an existing stock.

### Run as Daemon (Background Service)

```bash
npm run daemon
```

Starts a background service that automatically updates prices at the configured interval (default: every 60 minutes).

## Swiss Stock Tickers

Swiss stocks on Yahoo Finance use the `.SW` suffix. The extension automatically adds this suffix, so you can use either format:

- `NESN` or `NESN.SW` (Nestlé)
- `NOVN` or `NOVN.SW` (Novartis)
- `ROG` or `ROG.SW` (Roche)

### Common Swiss Stocks (SMI Components)

| Company | Ticker | Yahoo Finance Ticker |
|---------|--------|---------------------|
| Nestlé | NESN | NESN.SW |
| Novartis | NOVN | NOVN.SW |
| Roche | ROG | ROG.SW |
| UBS | UBSG | UBSG.SW |
| Zurich Insurance | ZURN | ZURN.SW |
| ABB | ABBN | ABBN.SW |
| Richemont | CFR | CFR.SW |
| Lonza | LONN | LONN.SW |
| Geberit | GEBN | GEBN.SW |
| Givaudan | GIVN | GIVN.SW |
| Sika | SIKA | SIKA.SW |
| Swiss Re | SREN | SREN.SW |
| Holcim | HOLN | HOLN.SW |
| Swisscom | SCMN | SCMN.SW |
| Alcon | ALC | ALC.SW |
| Partners Group | PGHN | PGHN.SW |
| SGS | SGSN | SGSN.SW |
| Straumann | STMN | STMN.SW |
| SIG Group | SIGN | SIGN.SW |
| Kuehne+Nagel | KNIN | KNIN.SW |

For more Swiss stocks, visit [SIX Swiss Exchange](https://www.six-group.com/en/products-services/the-swiss-stock-exchange.html) and add `.SW` suffix for Yahoo Finance.

## How It Works

1. **Stock Data**: Fetches prices from Yahoo Finance using the `yahoo-finance2` library
2. **Account Creation**: Creates investment accounts in Actual Budget (one per stock)
3. **Balance Updates**: Updates account balances by creating adjustment transactions
4. **Portfolio Tracking**: Maintains a local `portfolio.json` file with stock quantities and metadata

## Architecture

```
┌─────────────┐
│     CLI     │
└──────┬──────┘
       │
       v
┌────────────────────┐
│ Portfolio Manager  │
└──────┬─────────────┘
       │
       ├─────────────────────┐
       │                     │
       v                     v
┌──────────────┐    ┌──────────────────┐
│Stock Fetcher │    │ Actual Client    │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       v                     v
┌──────────────┐    ┌──────────────────┐
│Yahoo Finance │    │ Actual Budget    │
└──────────────┘    └──────────────────┘
```

## Troubleshooting

### "Failed to initialize Actual Budget"

- Verify your `ACTUAL_SERVER_URL` is correct
- Check that Actual Budget server is running
- Confirm your password is correct

### "No price data available for [ticker]"

- Verify the ticker symbol is correct
- Check if the stock trades on SIX Swiss Exchange
- Try using the full format (e.g., `NESN.SW`)

### "Stock already exists in portfolio"

- Use `set-quantity` to update the quantity instead
- Or remove and re-add the stock

### Account balance doesn't match

- Run `npm start update` to sync prices
- Check that the correct quantity is set
- Verify no manual transactions were added to the account

## Limitations

- **Yahoo Finance API**: Uses an unofficial API that may change or break
- **Price Delays**: Prices may be delayed (usually 15-30 minutes)
- **Swiss Focus**: Optimized for Swiss stocks; other markets may work but are untested
- **Single Currency**: Portfolio value assumes all stocks trade in CHF

## Data Storage

- **Portfolio data**: Stored in `portfolio.json` (contains stock quantities and metadata)
- **Actual Budget data**: Stored in `./data` directory (synced with server)
- **Sensitive data**: Never commit `.env` or `portfolio.json` to version control

## Development

### Project Structure

```
actual-swissmarket-extension/
├── src/
│   ├── index.js              # CLI entry point
│   ├── stock-fetcher.js      # Yahoo Finance integration
│   ├── actual-client.js      # Actual Budget API wrapper
│   └── portfolio-manager.js  # Portfolio management logic
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### Running in Development

```bash
# Run CLI commands
node src/index.js add NESN 100

# Or use npm scripts
npm start add NESN 100
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Disclaimer

This extension is not affiliated with Actual Budget, Yahoo Finance, or SIX Swiss Exchange. Use at your own risk. Stock prices are provided for informational purposes only.
