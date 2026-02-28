# Use Node.js 22 LTS (Alpine for smaller image size)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application source
COPY src/ ./src/
COPY public/ ./public/

# Create data directory for Actual Budget
RUN mkdir -p /app/data

# Create volume mount points
VOLUME ["/app/data", "/app/portfolio.json"]

# Expose web server port
EXPOSE 3000

# Set environment variables with defaults
ENV NODE_ENV=production \
    ACTUAL_DATA_DIR=/app/data \
    PORTFOLIO_FILE=/app/portfolio.json

# Make the CLI executable
RUN chmod +x /app/src/index.js

# Set the entrypoint
ENTRYPOINT ["node", "/app/src/index.js"]

# Default command (list portfolio)
CMD ["list"]
