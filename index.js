const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const {v4: uuidv4} = require('uuid');
const path = require('path');

const app = express();
const PORT = 5015;
const OUTPUT_DIR = '/tmp/screenshots';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
}

let browser;

(async () => {
    try {
        browser = await puppeteer.launch({
            headless: true,
            userDataDir: '/tmp/puppeteer_profile',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter', '--ignore-certificate-errors',
                   '--user-data-dir=/tmp/chrome-user-data', '--crash-dumps-dir=/tmp/chrome-crash'],
        });
        console.log('Puppeteer browser started');
    } catch (err) {
        console.error('Failed to launch Puppeteer browser:', err);
        process.exit(1);
    }
})();

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('Missing ?url=');
    }

    if (!browser) {
        return res.status(503).send('Browser not ready');
    }

    const filename = uuidv4();
    const filepath = path.join(OUTPUT_DIR, `${filename}.jpg`);

    let page;

    try {
        page = await browser.newPage();
        await page.setViewport({width: 1536, height: 630});

        const response = await page.goto(url, {waitUntil: 'load', timeout: 30000});

        if (!response) {
            throw new Error('No response received from page');
        }

        const status = response.status();
        if (status !== 200) {
            return res.status(status).send(`Page returned status code ${status}`);
        }

        await new Promise(resolve => setTimeout(resolve, 10000));

        const start = Date.now();
        while (Date.now() - start < 60_000) {
            const hidden = await page.evaluate(() => {
                const el = document.getElementById('loading-spinner');
                return !el || el.style.display === 'none';
            });
            if (hidden) break;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        await page.screenshot({
            path: filepath,
            type: 'jpeg',
            quality: 100,
            fullPage: true,
        });

        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(filepath, () => fs.unlinkSync(filepath));
    } catch (err) {
        console.error('Screenshot error:', err);
        res.status(500).send('Failed to take screenshot');
    } finally {
        if (page) {
            await page.close();
        }
    }
});

app.get('/health', (req, res) => {
    res.json({status: 'ok'});
});

app.listen(PORT, () => {
    console.log(`Screenshot service listening on port ${PORT}`);
});
