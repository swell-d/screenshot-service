FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
    libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    xdg-utils wget ca-certificates \
    git curl && \
    apt-get autoremove -y && apt-get clean && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app
RUN git clone --depth=1 https://github.com/swell-d/screenshot-service.git /app

RUN mkdir -p /home/node/.cache/puppeteer /home/node/.config /tmp/chrome-user-data /tmp/chrome-crash && chown -R node:node /home/node /tmp
RUN npm install
RUN npx puppeteer browsers install chrome

EXPOSE 5015
CMD ["npm", "start"]
