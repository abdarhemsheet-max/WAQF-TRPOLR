FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=10000
ENV ALLOWED_ORIGINS=https://abdarhemsheet-max.github.io,http://localhost:5173

EXPOSE 10000

CMD ["node", "server.js"]
