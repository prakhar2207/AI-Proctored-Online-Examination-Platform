FROM python:3.12-slim

# Install system dependencies (Node.js 22, Tesseract OCR, OpenCV drivers, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Backend Dependencies
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 2. Install Frontend Dependencies & Build Next.js
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm ci

# 3. Copy Application Code
COPY backend /app/backend
COPY frontend /app/frontend
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Build Next.js Production Bundle
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd /app/frontend && npm run build

EXPOSE 10000

CMD ["/app/start.sh"]
