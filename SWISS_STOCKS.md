# Swiss Stock Ticker Reference

A comprehensive guide to finding and using Swiss stock tickers with this extension.

## How Swiss Tickers Work

Swiss stocks listed on the SIX Swiss Exchange use different ticker symbols depending on the data provider:

- **SIX Swiss Exchange**: Uses symbols like `NESN`, `NOVN`, `ROG`
- **Yahoo Finance**: Adds `.SW` suffix → `NESN.SW`, `NOVN.SW`, `ROG.SW`
- **This Extension**: Automatically converts to Yahoo Finance format

## SMI (Swiss Market Index) Components

The SMI is Switzerland's most important stock index, comprising the 20 largest and most liquid stocks.

### Current SMI Components

| Company Name | Sector | SIX Ticker | Yahoo Ticker | ISIN |
|-------------|--------|------------|--------------|------|
| **ABB Ltd** | Industrials | ABBN | ABBN.SW | CH0012221716 |
| **Alcon Inc** | Health Care | ALC | ALC.SW | CH0432492467 |
| **Geberit AG** | Industrials | GEBN | GEBN.SW | CH0030170408 |
| **Givaudan SA** | Materials | GIVN | GIVN.SW | CH0010645932 |
| **Holcim Ltd** | Materials | HOLN | HOLN.SW | CH0012214059 |
| **Nestlé SA** | Consumer Staples | NESN | NESN.SW | CH0038863350 |
| **Novartis AG** | Health Care | NOVN | NOVN.SW | CH0012005267 |
| **Partners Group** | Financials | PGHN | PGHN.SW | CH0024608827 |
| **Roche Holding AG** | Health Care | ROG | ROG.SW | CH0012032048 |
| **Sandoz Group AG** | Health Care | SDZ | SDZ.SW | CH1243598427 |
| **Sika AG** | Materials | SIKA | SIKA.SW | CH0418792922 |
| **Swisscom AG** | Telecom | SCMN | SCMN.SW | CH0008742519 |
| **Swiss Re AG** | Financials | SREN | SREN.SW | CH0126881561 |
| **UBS Group AG** | Financials | UBSG | UBSG.SW | CH0244767585 |
| **Zurich Insurance** | Financials | ZURN | ZURN.SW | CH0011075394 |
| **Lonza Group AG** | Health Care | LONN | LONN.SW | CH0013841017 |
| **Richemont** | Consumer Discr. | CFR | CFR.SW | CH0210483332 |
| **Kuehne+Nagel** | Industrials | KNIN | KNIN.SW | CH0025238863 |
| **SGS SA** | Industrials | SGSN | SGSN.SW | CH0002497458 |
| **Straumann Holding** | Health Care | STMN | STMN.SW | CH0012280076 |

## Other Popular Swiss Stocks

### Banks & Financial Services

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| Julius Bär | BAER | BAER.SW |
| EFG International | EFGN | EFGN.SW |
| Vontobel | VONN | VONN.SW |

### Insurance

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| Baloise | BALN | BALN.SW |
| Helvetia | HELN | HELN.SW |

### Retail & Consumer

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| Lindt & Sprüngli | LISN | LISN.SW |
| Swatch Group | UHR | UHR.SW |
| Barry Callebaut | BARN | BARN.SW |

### Technology & Services

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| Temenos | TEMN | TEMN.SW |
| Logitech | LOGN | LOGN.SW |
| SoftwareOne | SWON | SWON.SW |

### Real Estate

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| PSP Swiss Property | PSPN | PSPN.SW |
| Swiss Prime Site | SPSN | SPSN.SW |

### Energy & Utilities

| Company | Ticker | Yahoo Ticker |
|---------|--------|--------------|
| BKW | BKW | BKW.SW |

## How to Find Tickers

### Method 1: SIX Swiss Exchange Website

1. Visit [SIX Swiss Exchange](https://www.six-group.com/en/products-services/the-swiss-stock-exchange.html)
2. Search for your company
3. Note the ticker symbol (e.g., `NESN`)
4. Add `.SW` for use with this extension

### Method 2: Yahoo Finance

1. Go to [Yahoo Finance](https://finance.yahoo.com)
2. Search for the company name + "Switzerland"
3. The ticker will already include the `.SW` suffix

### Method 3: Bloomberg/Reuters

- **Bloomberg**: Symbol format `NESN SW Equity`
- **Reuters**: Symbol format `NESN.S`
- **For this extension**: Use `NESN.SW` or just `NESN`

## Usage Examples

### Adding SMI Blue Chips

```bash
# Add major Swiss pharmaceutical stocks
npm start add NOVN 50    # Novartis
npm start add ROG 25     # Roche
npm start add LONN 10    # Lonza

# Add Swiss banks
npm start add UBSG 200   # UBS

# Add consumer goods
npm start add NESN 75    # Nestlé
npm start add GIVN 5     # Givaudan
```

### Building a Diversified Portfolio

```bash
# Pharma/Healthcare (40%)
npm start add NOVN 100
npm start add ROG 50
npm start add ALC 75

# Financials (30%)
npm start add UBSG 300
npm start add ZURN 50

# Industrials (20%)
npm start add ABB 150
npm start add GEBN 20

# Consumer (10%)
npm start add NESN 100
```

## Ticker Validation

The extension will:

- ✅ Automatically add `.SW` suffix if missing
- ✅ Convert to uppercase
- ✅ Validate ticker exists on Yahoo Finance
- ❌ Error if ticker not found

## Notes

- **Dual-listed stocks**: Some Swiss companies are listed on multiple exchanges. Always use the `.SW` suffix for SIX Swiss Exchange listings.
- **Currency**: Most Swiss stocks trade in CHF (Swiss Francs)
- **Trading hours**: SIX Swiss Exchange is open 9:00-17:30 CET
- **Ticker changes**: Companies occasionally change tickers due to mergers, splits, or rebranding

## Resources

- [SIX Swiss Exchange](https://www.six-group.com)
- [Swiss Market Index (SMI)](https://www.six-group.com/en/products-services/the-swiss-stock-exchange/market-data/indices/smi.html)
- [Yahoo Finance Swiss Stocks](https://finance.yahoo.com/world-indices/)

## Symbol Format Summary

| Platform | Format | Example |
|----------|--------|---------|
| SIX Swiss Exchange | `NESN` | NESN |
| Yahoo Finance | `TICKER.SW` | NESN.SW |
| Bloomberg | `TICKER SW` | NESN SW |
| Reuters | `TICKER.S` | NESN.S |
| **This Extension** | `TICKER` or `TICKER.SW` | NESN or NESN.SW |
