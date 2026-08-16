#!/bin/bash
set -e

# Run Django migrations & seed users
echo "Running Django migrations..."
python /app/backend/manage.py migrate --noinput
python /app/backend/seed_users.py || true

# Start Django Daphne ASGI server on port 8000 in background
echo "Starting Django Daphne ASGI Server on port 8000..."
daphne -b 127.0.0.1 -p 8000 config.asgi:application &

# Give backend 3 seconds to spin up
sleep 3

# Start Next.js frontend server on Render's assigned $PORT (default 10000)
echo "Starting Next.js Frontend Server on port ${PORT:-10000}..."
cd /app/frontend
export NEXT_PUBLIC_API_URL="http://127.0.0.1:8000/api"
export PORT=${PORT:-10000}
exec npm run start
