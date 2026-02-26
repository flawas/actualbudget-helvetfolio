# Web GUI Guide

Modern web interface for managing your Swiss stock portfolio.

## Quick Start

### Local Installation

1. **Install dependencies** (if not already done):

   ```bash
   npm install
   ```

2. **Start the web server**:

   ```bash
   npm run web
   ```

3. **Open your browser**:

   ```
   http://localhost:3000
   ```

### Docker

```bash
# Start web GUI with Docker Compose
docker-compose up -d helvetfolio-web

# Access at:
http://localhost:3000
```

## Features

### 📊 Portfolio Dashboard

- Real-time portfolio summary
- Total value and gains/losses
- Stock count

### ➕ Add Stocks

- Add new stocks with current or historical prices
- Support for purchase date and price tracking
- Swiss ticker auto-completion

### 🗑️ Remove Stocks

- One-click stock removal
- Confirmation dialog for safety

### 🔄 Update Prices

- Refresh all stock prices with one click
- Automatic sync with Actual Budget

### 📈 Performance Tracking

- View gains/losses for each stock
- Color-coded profit/loss indicators
- Detailed purchase history

## Screenshots

The GUI features:

- **Dark theme** with Swiss flag red accents
- **Modern glassmorphism** design
- **Smooth animations** and transitions
- **Responsive layout** for mobile and desktop
- **Toast notifications** for user feedback

## Usage

### Adding a Stock

1. Click "➕Add Stock" button
2. Enter ticker (e.g., NESN, NOVN, ROG)
3. Enter quantity
4. Optionally add purchase date and price
5. Click "Add Stock"

### Removing a Stock

1. Find the stock card
2. Click the 🗑️ icon
3. Confirm removal

### Updating Prices

Click the "🔄 Update Prices" button to fetch latest prices for all stocks.

### Viewing Performance

Stock cards automatically display:

- Purchase price vs. current price
- Total gain/loss in CHF
- Gain/loss percentage (color-coded)

## Configuration

### Port

Default port is `3000`. Change via environment variable:

```bash
# .env file
WEB_PORT=8080
```

Then start with:

```bash
npm run web
```

Or with Docker:

```bash
WEB_PORT=8080 docker-compose up helvetfolio-web
```

### Actual Budget Connection

Configure in `.env`:

```env
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=your-password
ACTUAL_BUDGET_ID=your-budget-id
```

## API Endpoints

The web server exposes these REST API endpoints:

### GET /api/portfolio

Get portfolio summary

**Response**:

```json
{
  "totalStocks": 3,
  "stocks": [...],
  "totalValue": 50000.00
}
```

### GET /api/performance

Get portfolio with performance metrics

**Response**:

```json
{
  "totalStocks": 3,
  "stocks": [...],
  "totalCostBasis": 45000.00,
  "totalValue": 50000.00,
  "totalGain": 5000.00,
  "totalGainPercent": 11.11
}
```

### POST /api/stocks

Add a new stock

**Request**:

```json
{
  "ticker": "NESN",
  "quantity": 100,
  "purchaseDate": "2020-03-15",
  "purchasePrice": 95.00
}
```

### DELETE /api/stocks/:ticker

Remove a stock

**Example**: `/api/stocks/NESN.SW`

### PUT /api/stocks/:ticker/quantity

Update stock quantity

**Request**:

```json
{
  "quantity": 150
}
```

### POST /api/update-prices

Update all stock prices

## Accessing from Other Devices

### Same Network

Find your computer's IP address:

```bash
# macOS/Linux
ifconfig | grep inet

# Windows
ipconfig
```

Then access from other devices:

```
http://YOUR_IP:3000
```

For example: `http://192.168.1.100:3000`

### Docker with Custom Port

```bash
# Map to port 8080
WEB_PORT=8080 docker-compose up helvetfolio-web

# Access at:
http://localhost:8080
```

## Development

### File Structure

```
public/
├── index.html    # Main HTML structure
├── styles.css    # Modern dark theme styles
└── app.js        # Client-side JavaScript

src/
└── web-server.js # Express REST API server
```

### Customizing Styles

Edit `public/styles.css` to customize:

- Colors (see CSS variables at top)
- Layout and spacing
- Animations
- Responsive breakpoints

### Adding Features

1. Add API endpoint in `src/web-server.js`
2. Update frontend in `public/app.js`
3. Add UI elements in `public/index.html`
4. Style in `public/styles.css`

## Troubleshooting

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change port or stop other service:

```bash
# Use different port
WEB_PORT=3001 npm run web

# Or find and stop process on port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Can't Connect to Actual Budget

**Error**: `ECONNREFUSED` or connection timeout

**Solutions**:

1. Verify Actual Budget is running
2. Check `ACTUAL_SERVER_URL` in `.env`
3. For Docker, use `host.docker.internal` instead of `localhost`

### Stocks Not Loading

1. Check browser console (F12) for errors
2. Verify portfolio.json exists
3. Check server logs
4. Ensure .env configuration is correct

### CORS Errors

If accessing from a different domain/port, the server already has CORS enabled. If still seeing errors, check browser console for specific issues.

## Security Notes

### Production Deployment

For production use:

1. **Add authentication**:
   - Implement login system
   - Use JWT tokens
   - Add rate limiting

2. **Use HTTPS**:
   - Set up SSL certificate
   - Use reverse proxy (nginx, Caddy)

3. **Environment variables**:
   - Never commit `.env` to git
   - Use secrets management

### Firewall

If exposing to network:

```bash
# Allow port 3000 (macOS)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node

# Or use firewall GUI settings
```

## Keyboard Shortcuts

- **Esc**: Close add stock modal
- **Enter**: Submit add stock form (when focused)

## Browser Support

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 not supported

## Mobile Experience

The GUI is fully responsive and works on:

- 📱 Phones (iOS/Android)
- 📟 Tablets
- 💻 Desktops

Touch gestures supported for all interactions.

## Performance

- Fast initial load (< 1MB total)
- Real-time updates without page refresh
- Optimized animations (60fps)
- Minimal API calls

## Next Steps

- Add charts/graphs for performance visualization
- Export portfolio to CSV/PDF
- Email notifications for price alerts
- Dark/light theme toggle
- Multi-currency support
