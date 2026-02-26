# Historical Purchase Tracking

Track your stock purchases from the past, including purchase dates and prices, to calculate gains/losses.

## Adding Historical Stocks

### Stocks Bought in 2020 (or any past date)

```bash
# Add Nestlé bought on March 15, 2020 at 95 CHF
npm start add NESN 100 --date 2020-03-15 --price 95.00

# Or using Docker
docker-compose run --rm helvetfolio add NESN 100 --date 2020-03-15 --price 95.00
```

### General Syntax

```bash
npm start add <TICKER> <QUANTITY> --date <YYYY-MM-DD> --price <PRICE>
```

**Options:**

- `--date` or `-d`: Purchase date in YYYY-MM-DD format
- `--price` or `-p`: Purchase price per share

If you omit these options, the current date and current market price will be used.

## Examples

### Portfolio from 2020

```bash
# Swiss pharma stocks bought during COVID crash (March 2020)
npm start add NOVN 50 --date 2020-03-18 --price 75.50
npm start add ROG 25 --date 2020-03-20 --price 290.00
npm start add LONN 10 --date 2020-03-25 --price 385.00

# Swiss banks bought later in 2020
npm start add UBSG

 200 --date 2020-11-15 --price 11.50
```

### Mixed Portfolio (Different Purchase Dates)

```bash
# Nestlé bought in 2019
npm start add NESN 100 --date 2019-06-10 --price 98.50

# Novartis bought in 2020
npm start add NOVN 75 --date 2020-03-15 --price 75.00

# Roche bought in 2021
npm start add ROG 30 --date 2021-09-20 --price 335.00

# UBS bought recently (will use current price)
npm start add UBSG 300
```

## Viewing Performance

### Performance Command

See your gains and losses:

```bash
npm start performance
```

**Output includes:**

- Purchase date
- Purchase price
- Cost basis (quantity × purchase price)
- Current price
- Current value
- Gain/Loss in CHF
- Gain/Loss percentage
- Total portfolio performance

**Example Output:**

```
📊 Portfolio Performance (4 stocks):

  NESN.SW - Nestlé SA
    Quantity: 100
    Purchase Date: 2020-03-15
    Purchase Price: 95.00 CHF
    Cost Basis: 9500.00 CHF
    Current Price: 105.50 CHF
    Current Value: 10550.00 CHF
    Gain/Loss: +1050.00 CHF (+11.05%)
    Last Updated: 1/25/2026, 12:00:00 PM

  NOVN.SW - Novartis AG
    Quantity: 50
    Purchase Date: 2020-03-18
    Purchase Price: 75.50 CHF
    Cost Basis: 3775.00 CHF
    Current Price: 85.30 CHF
    Current Value: 4265.00 CHF
    Gain/Loss: +490.00 CHF (+12.98%)
    Last Updated: 1/25/2026, 12:00:00 PM

📈 Total Portfolio:
  Total Cost Basis: 13275.00 CHF
  Current Value: 14815.00 CHF
  Total Gain/Loss: +1540.00 CHF (+11.60%)
```

## Portfolio Data Structure

Your `portfolio.json` file now includes:

```json
{
  "stocks": [
    {
      "ticker": "NESN.SW",
      "name": "Nestlé SA",
      "quantity": 100,
      "accountId": "abc123",
      "currency": "CHF",
      "lastPrice": 105.50,
      "lastUpdated": "2026-01-25T11:00:00Z",
      "purchaseDate": "2020-03-15",
      "purchasePrice": 95.00,
      "costBasis": 9500.00
    }
  ]
}
```

## Understanding the Metrics

### Cost Basis

Total amount you paid for the stock:

```
Cost Basis = Quantity × Purchase Price
```

### Gain/Loss (CHF)

Absolute profit or loss:

```
Gain/Loss = Current Value - Cost Basis
Gain/Loss = (Quantity × Current Price) - (Quantity × Purchase Price)
```

### Gain/Loss (%)

Return on investment:

```
Gain % = (Gain / Cost Basis) × 100
```

## Use Cases

### Tax Reporting

- Track cost basis for capital gains tax
- Know exact purchase dates
- Calculate holding periods

### Performance Analysis

- See which stocks performed best
- Compare purchase timing
- Evaluate investment decisions

### Portfolio Rebalancing

- Identify underperforming stocks
- Find opportunities to take profits
- Rebalance based on performance

## Migrating Existing Stocks

If you already added stocks without purchase information, you can:

1. **Remove and re-add** with historical data:

```bash
npm start remove NESN
npm start add NESN 100 --date 2020-03-15 --price 95.00
```

1. **Manually edit** `portfolio.json`:

```json
{
  "ticker": "NESN.SW",
  "purchaseDate": "2020-03-15",
  "purchasePrice": 95.00,
  "costBasis": 9500.00
}
```

## Tips

### Finding Historical Prices

1. **Yahoo Finance**: View historical data
   - Go to <https://finance.yahoo.com>
   - Search for stock (e.g., "NESN.SW")
   - Click "Historical Data"
   - Select your purchase date

2. **SIX Swiss Exchange**: Historical prices
   - Visit <https://www.six-group.com>
   - Look up historical quotes

3. **Bank Statements**: Check your transaction records for exact prices

### Multiple Purchases (Same Stock)

If you bought the same stock at different times, calculate average:

```bash
# Bought NESN twice:
# - 50 shares at 95 CHF on 2020-03-15
# - 50 shares at 102 CHF on 2021-06-10
# Average price = (50×95 + 50×102) / 100 = 98.50 CHF

npm start add NESN 100 --date 2020-03-15 --price 98.50
```

Or track separately by adding a suffix (requires code modification).

## Docker Usage

All commands work the same with Docker:

```bash
# Add historical stock
docker-compose run --rm helvetfolio add NESN 100 --date 2020-03-15 --price 95.00

# View performance
docker-compose run --rm helvetfolio performance
```

## Backup Recommendations

Since performance data is valuable:

```bash
# Backup portfolio regularly
cp portfolio.json ~/backups/portfolio-$(date +%Y%m%d).json

# Or use automated backup
0 0 * * * cp /path/to/portfolio.json /path/to/backups/portfolio-$(date +\%Y\%m\%d).json
```
