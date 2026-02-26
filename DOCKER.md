# Docker Deployment Guide

Complete guide for running the Helvetfolio as a Docker container.

## Quick Start

### 1. Setup Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

Required variables in `.env`:

```env
ACTUAL_SERVER_URL=http://host.docker.internal:5006
ACTUAL_PASSWORD=your-password
ACTUAL_BUDGET_ID=your-budget-id
UPDATE_INTERVAL_MINUTES=60
```

> [!NOTE]
> Use `host.docker.internal` instead of `localhost` to connect to Actual Budget running on your host machine.

### 2. Initialize Portfolio

```bash
# Create empty portfolio file
echo '{"stocks":[]}' > portfolio.json

# Create data directory
mkdir -p data
```

### 3. Build the Image

```bash
docker-compose build
```

## Usage

### Interactive Commands

#### Add a Stock

```bash
docker-compose run --rm helvetfolio add NESN 100
```

#### Remove a Stock

```bash
docker-compose run --rm helvetfolio remove NESN
```

#### Update All Prices

```bash
docker-compose run --rm helvetfolio update
```

#### List Portfolio

```bash
docker-compose run --rm helvetfolio list
```

#### Update Stock Quantity

```bash
docker-compose run --rm helvetfolio set-quantity NESN 150
```

### Daemon Mode (Continuous Updates)

Start the daemon service to automatically update prices every hour (or your configured interval):

```bash
docker-compose up -d helvetfolio-daemon
```

View logs:

```bash
docker-compose logs -f helvetfolio-daemon
```

Stop daemon:

```bash
docker-compose down
```

## Alternative: Direct Docker Commands

If you prefer not to use docker-compose:

### Build

```bash
docker build -t helvetfolio .
```

### Run Commands

```bash
# Add stock
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/portfolio.json:/app/portfolio.json \
  helvetfolio add NESN 100

# List portfolio
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/portfolio.json:/app/portfolio.json \
  helvetfolio list

# Update prices
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/portfolio.json:/app/portfolio.json \
  helvetfolio update
```

### Run Daemon

```bash
docker run -d \
  --name helvetfolio-daemon \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/portfolio.json:/app/portfolio.json \
  --restart unless-stopped \
  helvetfolio start-daemon
```

## Environment Variable Injection

### Method 1: .env File (Recommended)

Create `.env` file:

```env
ACTUAL_SERVER_URL=http://host.docker.internal:5006
ACTUAL_PASSWORD=mypassword
ACTUAL_BUDGET_ID=my-budget-123
UPDATE_INTERVAL_MINUTES=60
```

Docker Compose automatically loads this file.

### Method 2: Override in docker-compose.yml

Edit `docker-compose.yml` and modify the `environment` section:

```yaml
environment:
  ACTUAL_SERVER_URL: http://my-server:5006
  ACTUAL_PASSWORD: mypassword
  ACTUAL_BUDGET_ID: my-budget-123
```

### Method 3: Command Line Override

```bash
ACTUAL_SERVER_URL=http://example.com:5006 \
ACTUAL_PASSWORD=secret \
docker-compose run helvetfolio list
```

### Method 4: Separate Environment File

```bash
docker-compose --env-file .env.production run helvetfolio list
```

## Volume Mounts

### Local Directories

- `./data` → `/app/data` - Actual Budget local data
- `./portfolio.json` → `/app/portfolio.json` - Your stock portfolio

### Custom Paths

To use custom paths, modify `docker-compose.yml`:

```yaml
volumes:
  - /path/to/my/data:/app/data
  - /path/to/my/portfolio.json:/app/portfolio.json
```

## Networking

### Connecting to Actual Budget

#### Local Actual Budget (on host machine)

```env
ACTUAL_SERVER_URL=http://host.docker.internal:5006
```

#### Remote Actual Budget Server

```env
ACTUAL_SERVER_URL=https://budget.example.com
```

#### Actual Budget in Docker Container

If both are in the same Docker network:

```env
ACTUAL_SERVER_URL=http://actual-budget:5006
```

To share a network:

```yaml
services:
  helvetfolio:
    networks:
      - budget-network

networks:
  budget-network:
    external: true
```

## Scheduling with Cron (Alternative to Daemon)

Instead of daemon mode, use host cron:

```bash
# Add to crontab
crontab -e
```

Add:

```cron
# Update stock prices every hour
0 * * * * cd /path/to/actual-swissmarket-extension && docker-compose run --rm helvetfolio update >> /var/log/stocks.log 2>&1
```

## Backup and Restore

### Backup Portfolio

```bash
cp portfolio.json portfolio.backup.json
```

### Restore Portfolio

```bash
cp portfolio.backup.json portfolio.json
```

### Backup Actual Budget Data

```bash
tar -czf data-backup.tar.gz data/
```

## Troubleshooting

### Container Can't Connect to Actual Budget

**Problem**: `ECONNREFUSED` or connection timeout

**Solutions**:

1. Use `host.docker.internal` instead of `localhost`
2. Check Actual Budget is running: `curl http://localhost:5006`
3. Verify firewall allows Docker connections
4. Try bridge network mode

### Portfolio File Not Persisting

**Problem**: Changes lost after container stops

**Solution**: Ensure volume mount is correct

```bash
# Check mounts
docker inspect helvetfolio | grep Mounts -A 10
```

### Permission Errors

**Problem**: Can't write to `portfolio.json`

**Solution**: Fix file permissions

```bash
chmod 666 portfolio.json
```

### Environment Variables Not Loading

**Problem**: Settings not applied

**Solution**: Verify .env file

```bash
# Check loaded env vars
docker-compose config
```

## Performance

### Image Size

- Base image: ~180MB (Node 20 Alpine)
- With dependencies: ~250MB

### Resource Limits

Add to `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

## Security

### Protecting Credentials

1. **Never commit .env**
   - Already in `.gitignore`

2. **Use Docker secrets** (Swarm mode):

```yaml
secrets:
  actual_password:
    file: ./secrets/password.txt

services:
  helvetfolio:
    secrets:
      - actual_password
```

1. **Environment variable from secrets**:

```bash
export ACTUAL_PASSWORD=$(cat secrets/password.txt)
docker-compose run helvetfolio list
```

## Multi-Platform Builds

Build for different architectures:

```bash
# Build for ARM (Raspberry Pi, M1/M2 Mac)
docker buildx build --platform linux/arm64 -t helvetfolio:arm64 .

# Build for both AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t helvetfolio:latest .
```

## Docker Hub Publishing

```bash
# Tag image
docker tag helvetfolio:latest yourusername/helvetfolio:latest

# Push to Docker Hub
docker push yourusername/helvetfolio:latest

# Pull and run from anywhere
docker pull yourusername/helvetfolio:latest
```

## Complete Example Workflow

```bash
# Setup
cp .env.example .env
nano .env  # Edit configuration
echo '{"stocks":[]}' > portfolio.json
mkdir -p data

# Build
docker-compose build

# Add stocks
docker-compose run --rm helvetfolio add NESN 100
docker-compose run --rm helvetfolio add NOVN 50
docker-compose run --rm helvetfolio add ROG 25

# View portfolio
docker-compose run --rm helvetfolio list

# Start automatic updates
docker-compose up -d helvetfolio-daemon

# Check logs
docker-compose logs -f helvetfolio-daemon

# Manual update
docker-compose run --rm helvetfolio update

# Stop daemon
docker-compose down
```

## Next Steps

- Monitor logs regularly
- Set up automatic backups
- Configure monitoring/alerts
- Consider Kubernetes for production
