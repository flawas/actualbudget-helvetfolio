# Troubleshooting

## Container exits immediately

**Cause**: The default `MODE` is `cli`, which runs `list` and exits. That is expected for a one-shot CLI command.

**Fix**: Set `MODE=web` or `MODE=daemon` for long-running services.

```bash
docker run -d -p 3000:3000 -e MODE=web ghcr.io/flawas/helvetfolio:latest
```

---

## Can't connect to Actual Budget

**Symptoms**: `ECONNREFUSED`, connection timeout, or "Connection failed" in the web UI.

**Fixes**:

- When Actual Budget runs on the host machine, use `http://host.docker.internal:5006` (not `localhost`)
- Verify Actual Budget is running: `curl http://localhost:5006`
- Check the server URL and password in **Settings**

---

## Port already in use

```bash
WEB_PORT=3001 docker compose up -d helvetfolio-web
```

---

## Data not persisting between container restarts

Mount the `./data` directory:

```bash
docker run -d -p 3000:3000 -e MODE=web \
  -v $(pwd)/data:/app/data \
  ghcr.io/flawas/helvetfolio:latest
```

Check the mount is in place:

```bash
docker inspect helvetfolio-web | grep -A5 Mounts
```

---

## Prices not updating

- Click **Update Prices** in the web UI and read the toast notification
- Verify the ticker is valid on Yahoo Finance (e.g. `NESN.SW`)
- Check logs: `docker compose logs -f helvetfolio-web`

---

## Verification

After setup, `list` should print `Portfolio is empty` (not an error):

```bash
docker run --rm ghcr.io/flawas/helvetfolio:latest list
# → Portfolio is empty
```
