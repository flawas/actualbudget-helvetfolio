<div align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="Helvetfolio logo"><br><br>

  # Changelog

  All notable changes to Helvetfolio are documented here.

  [← Back to README](README.md)
</div>

---

## [v1.1.0] — 2026-03-22

> UI redesign · Stock grouping · Custom modals · Login modal · Docs page

### ✨ Added

| Feature | Description |
|---|---|
| **Stock grouping** | Organise holdings into named groups from the portfolio table. Groups show aggregate value and gain/loss, collapse/expand on click, support rename (double-click) and delete. Keyed on `accountId` — duplicate tickers handled correctly. |
| **Column sorting** | Click any table header to sort ascending / descending. Arrow indicator shows the active direction. |
| **Sticky delete column** | Action column is `position: sticky; right: 0` — stays visible on narrow viewports when the table overflows horizontally. |
| **Custom dialog modals** | All native `confirm()` and `prompt()` calls replaced with a styled reusable modal (blur overlay, spring animation, danger button for destructive actions). |
| **Custom login modal** | Browser's native HTTP Basic Auth dialog replaced with a branded sign-in modal. Static assets are served without auth; the gate moves to `/api/*` only. `WWW-Authenticate` header omitted to prevent browser interception. Credentials stored in `sessionStorage`. |
| **Footer** | "Made with ❤️ by Flavio" with a link to the GitHub repository. |
| **Documentation page** | `docs.html` served at `/docs.html`, styled with the same design system as the main UI. |

### 🐛 Fixed

| Bug | Fix |
|---|---|
| **Buy price race condition** | `updateAllPrices()` now reloads the portfolio from disk immediately after the Yahoo Finance fetch completes. Previously, inline buy-price edits made during the fetch window were silently overwritten. |
| **Buy price = 0** | Purchase prices of `0` are now stored and displayed correctly. `\|\|`-based falsy checks replaced with `!= null` guards throughout `addStock`, `getPortfolioWithPerformance`, and `POST /api/stocks`. |
| **Group assignment with duplicate tickers** | Multiple positions of the same fund (same Yahoo ticker, different `accountId`) can each be independently assigned to a group. Uses `data-account-id` and `/api/stocks/by-account/:accountId/group` instead of the old ticker-based lookup. |
| **Group dropdown off-screen when scrolled** | Floating dropdown was adding `window.scrollY` to a `position: fixed` element. Corrected to use raw `getBoundingClientRect()` coordinates. |
| **Auth race condition on startup** | `loadPortfolio()` and `updateAddStockButtonState()` fired concurrently, each calling `_showLoginModal()` and overwriting `_loginResolve`. A shared `_authPromise` now ensures only one login flow runs at a time; all concurrent 401s retry automatically after auth completes. |

### 🔄 Changed

- **UI redesign** — individual summary cards with border and shadow, spring-curve modal animations, pill-shaped gain/loss badges, refined colour tokens, crisper shadow hierarchy, and consistent 40 px group-header rows with 10 px gap between groups.
- Group header rows use the page background colour (`--bg`) with a bold uppercase label, matching the table rhythm without a colour-clash gap above member rows.
- `display: flex` moved from `<td class="group-cell">` to an inner `<div class="group-cell">`, fixing a table-layout height inconsistency that caused a visible gap between group headers and their first member row.

---

## [v1.0.2] — 2026-03-21

> Zero-config start · Logo · Split container modes

### ✨ Added

- **Zero-config start-up** — the web UI launches without any pre-existing configuration file. Connection settings are entered through the Settings panel and persisted to `./data`.
- **Logo & favicon** — SVG icon (Swiss cross + upward trend line) shown in the browser tab and page header.
- **`docker-entrypoint.sh`** — single entrypoint script dispatches to the correct mode (`web`, `daemon`, or `cli`) based on the `MODE` environment variable.
- **Split container modes** — `docker-compose.yml` defines three named services: `helvetfolio-web`, `helvetfolio-daemon`, and `helvetfolio-cli`.
- **Multi-stage Dockerfile** — builder stage compiles native add-ons; runtime stage is a lean `node:22-alpine` image with no build tools.
- **Add-stock button guard** — the Add Stock button is disabled with a tooltip until a valid Actual Budget connection is configured.

### 🐛 Fixed

- CI pipeline: `sonarqube` job now explicitly sets Node 22 and uses `npm ci --ignore-scripts`, matching the `test` job. Previously the missing `setup-node` step caused postinstall scripts to fail, producing 0% function coverage.
- `coverage` npm script now calls `c8` directly instead of `yarn c8`.

### 🔄 Changed

- `docker-compose.yml` restructured to expose each mode as a separate, independently runnable service.
- Docs (README, DOCKER, QUICK_START, QUICK_REFERENCE, TROUBLESHOOTING, WEB_GUI) updated throughout to reflect zero-config setup and the new service split.

---

## [v1.0.1] — 2026-02-28

> Docker fix

### 🐛 Fixed

- Docker container failed to start due to missing data-directory setup in the `Dockerfile`.

### 🔄 Changed

- `docker-compose.yml` simplified; volume and environment variable handling cleaned up.
- Added `docker-compose.dev.yml` for local development (bind-mount source, live reload).
- README updated with clearer Docker usage examples and connection instructions.

---

## [v1.0.0] — 2026-02-28

> Initial release 🎉

### ✨ Features

- Fetches live stock prices from Yahoo Finance (`yahoo-finance2`) and writes them as Actual Budget account balances.
- **Web UI** — responsive portfolio table with inline editing (quantity, purchase price), manual refresh, and per-holding delete.
- **Daemon mode** — scheduled price sync via `node-cron`; interval configurable with `UPDATE_INTERVAL_MINUTES`.
- **CLI** — `add`, `remove`, `update`, `list`, `sync` commands via `commander`.
- Per-holding Actual Budget investment accounts created automatically on first sync.
- Exchange suffix configurable via `STOCK_EXCHANGE_SUFFIX` (default `.SW` for SIX Swiss Exchange).
- Docker image published to [Docker Hub](https://hub.docker.com/r/flawas/helvetfolio) and [GHCR](https://ghcr.io/flawas/helvetfolio).
- GitHub Actions CI pipeline with automated test, SonarQube analysis, and Docker build/push.
- 82 unit tests covering `StockFetcher`, `PortfolioManager`, and `ActualClient`.
