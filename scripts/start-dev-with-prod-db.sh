#!/bin/bash

echo "🔗 Starting database proxy to PRODUCTION..."

# Start the proxy in the background
flyctl proxy 5433:5432 -a ludora-db &
PROXY_PID=$!

# Function to cleanup proxy on exit
cleanup() {
    echo "🛑 Stopping proxy (PID: $PROXY_PID)..."
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true
    echo "✅ Proxy stopped"
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

echo "⏳ Waiting for proxy to establish connection..."

# Wait for proxy to be ready (test connection)
RETRY_COUNT=0
MAX_RETRIES=15
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -z localhost 5433 >/dev/null 2>&1; then
        echo "✅ Database proxy connection established on port 5433"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Attempt $RETRY_COUNT/$MAX_RETRIES - waiting for proxy..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Failed to establish proxy connection after $MAX_RETRIES attempts"
    echo "   Make sure you're authenticated with flyctl and ludora-db app is accessible"
    exit 1
fi

echo "🚀 Starting API server with PROD DB connection..."

# Start the API server with production database settings
DB_HOST=localhost \
DB_PORT=5433 \
DB_NAME=postgres \
DB_USER=postgres \
DB_PASSWORD=2SpoAsK11AJAhhE \
ENVIRONMENT=development \
node index.js