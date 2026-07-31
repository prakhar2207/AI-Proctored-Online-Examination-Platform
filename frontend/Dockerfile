FROM node:22-slim

WORKDIR /app

# Copy dependency configs
COPY package*.json /app/
RUN npm ci

# Copy application source code
COPY . /app/

EXPOSE 3000

# Start Next.js development server
CMD ["npm", "run", "dev"]
