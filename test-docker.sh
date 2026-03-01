#!/bin/bash

# Test script for Docker deployment
# This script tests the Docker setup without requiring a running Actual Budget instance

set -e

echo "🐳 Testing Docker Setup for Actual Helvetfolio"
echo "=========================================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Build the image
echo "📦 Building Docker image..."
docker build -t helvetfolio . || {
    echo "❌ Docker build failed"
    exit 1
}
echo "✅ Image built successfully"
echo ""

# Test that the image can run
echo "🧪 Testing image..."
docker run --rm helvetfolio --help > /dev/null 2>&1 || {
    echo "❌ Image test failed"
    exit 1
}
echo "✅ Image runs successfully"
echo ""

# Create test files if they don't exist
if [[ ! -f .env ]]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "✅ Created .env file"
else
    echo "ℹ️  .env already exists"
fi
echo ""

if [[ ! -f portfolio.json ]]; then
    echo "📝 Creating empty portfolio.json..."
    echo '{"stocks":[]}' > portfolio.json
    echo "✅ Created portfolio.json"
else
    echo "ℹ️  portfolio.json already exists"
fi
echo ""

# Create data directory
if [ ! -d data ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
    echo "✅ Created data directory"
else
    echo "ℹ️  data directory already exists"
fi
echo ""

echo "🎉 Docker setup is complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Actual Budget configuration"
echo "2. Run: docker-compose run --rm helvetfolio add NESN 100"
echo "3. Or see DOCKER.md for full documentation"
