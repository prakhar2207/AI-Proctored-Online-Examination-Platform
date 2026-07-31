FROM python:3.12-slim

# Install system dependencies (Tesseract OCR for image processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . /app/

# Expose Daphne ASGI server port
EXPOSE 8000

# Run migrations and start Daphne ASGI server
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
