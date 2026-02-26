# Installation Troubleshooting Guide

## better-sqlite3 Compilation Issues on macOS

If you encounter errors like `'climits' file not found` when running `npm install`, this is due to native compilation issues with the `better-sqlite3` dependency.

### Solution 1: Use Node.js LTS (Recommended)

The easiest solution is to use a Node.js LTS version (20.x) which has better native module support:

```bash
# Using nvm (Node Version Manager)
nvm install 20
nvm use 20

# Or using brew
brew install node@20
brew link node@20

# Then reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Solution 2: Install via Prebuilt Binaries

Try setting the npm configuration to prefer prebuilt binaries:

```bash
npm config set build_from_source false
npm install --prefer-offline
```

### Solution 3: Update XCode Command Line Tools

Ensure your XCode command line tools are up to date:

```bash
# Update via Software Update
softwareupdate --list
softwareupdate --install -a

# Or reinstall XCode CLI tools
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### Solution 4: Set C++ Compiler Flags

Sometimes setting specific compiler flags helps:

```bash
export CXXFLAGS="-std=c++17"
npm install
```

### Solution 5: Use Docker (Alternative Approach)

If native compilation continues to fail, you can run the extension in Docker:

1. Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

1. Build and run:

```bash
docker build -t helvetfolio .
docker run -it --env-file .env helvetfolio list
```

## Verification

After successful installation, verify with:

```bash
npm start list
```

You should see "Portfolio is empty" if everything is working correctly.

## Still Having Issues?

1. Check Node.js version: `node --version` (should be v18+ but v20 is recommended)
2. Check npm version: `npm --version`
3. Check Python version (required for node-gyp): `python3 --version`
4. Review npm error logs: `~/.npm/_logs/*.log`

## Alternative: Local-Only Mode

If you only want to track prices without Actual Budget integration, you can create a simpler version that just fetches and displays stock prices without the database dependency. Let me know if you'd like this alternative implementation.
