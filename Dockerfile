FROM node:slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros \
    fonts-kacst fonts-freefont-ttf dbus dbus-x11 \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libatspi2.0-0 libcairo2 libcups2 libgbm1 libglib2.0-0 libgtk-3-0 \
    libgtk-4-1 libnspr4 libnss3 libpango-1.0-0 libvulkan1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 wget xdg-utils \
    ca-certificates git curl && \
    apt-get autoremove -y && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV DBUS_SESSION_BUS_ADDRESS=autolaunch:
ENV PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer

USER node
WORKDIR /app
RUN git clone --depth=1 https://github.com/swell-d/screenshot-service.git /app && rm -rf /app/.git

RUN npm install
RUN PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer \
    npx puppeteer browsers install chrome@stable

EXPOSE 5015
CMD ["npm", "start"]
