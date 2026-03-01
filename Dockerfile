# Use Node.js 22 LTS (Alpine for smaller image size)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better-sqlite3 compilation
RUN apk add --no-cache g++ make python3

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application source
COPY src/ ./src/
COPY public/ ./public/

# Create data directory, set ownership, make CLI executable
RUN mkdir -p /app/data \
    && chown -R node:node /app/data \
    && chmod +x /app/src/index.js

# Expose web server port
EXPOSE 3000

# Set environment variables with defaults
ENV NODE_ENV=production \
    ACTUAL_DATA_DIR=/app/data \
    PORTFOLIO_FILE=/app/data/portfolio.json

# Run as non-root user
USER node

# Set the entrypoint
ENTRYPOINT ["node", "/app/src/index.js"]

# Default command (list portfolio)
CMD ["list"]
