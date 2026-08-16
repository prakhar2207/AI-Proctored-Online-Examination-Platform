FROM node:22-slim

WORKDIR /app

# Copy dependency configs
COPY package*.json /app/
RUN npm ci

# Copy application source code
COPY . /app/

# Build Next.js Production Bundle
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000

# Start Next.js production server on dynamic PORT
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
