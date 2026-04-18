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

const USER_DATA_DIR = '/tmp/chrome-user-data';
const CRASHPAD_DIR = '/tmp/chrome-crashpad';

const CHROME_ARGS = [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-crash-reporter', '--noerrdialogs', '--disable-breakpad',
    '--disable-features=Crashpad',
    '--enable-webgl', '--ignore-gpu-blocklist',
    '--ignore-certificate-errors',
    '--user-data-dir=${USER_DATA_DIR}',
    '--crash-dumps-dir=${CRASHPAD_DIR}',
];

let browser = null;
let launching = false;

async function launchBrowser() {
    if (launching) return;
    launching = true;
    try {
        // Clean up previous user data to avoid stale locks
        fs.rmSync(USER_DATA_DIR, {recursive: true, force: true});
        fs.mkdirSync(USER_DATA_DIR, {recursive: true});
        fs.mkdirSync(CRASHPAD_DIR, {recursive: true});
        browser = await puppeteer.launch({headless: true, args: CHROME_ARGS});
        browser.on('disconnected', () => {
            console.warn('Browser disconnected, will relaunch on next request');
            browser = null;
        });
        console.log('Puppeteer browser started');
    } catch (err) {
        console.error('Failed to launch browser:', err.message);
        browser = null;
    } finally {
        launching = false;
    }
}

async function getBrowser() {
    if (browser && browser.connected) return browser;
    await launchBrowser();
    return browser;
}

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('Missing ?url=');
    }

    const b = await getBrowser();
    if (!b) {
        return res.status(503).send('Browser not ready');
    }

    const filename = uuidv4();
    const filepath = path.join(OUTPUT_DIR, `${filename}.jpg`);

    let page;

    try {
        page = await b.newPage();
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

        // Hide spinner and any overlays before taking screenshot
        await page.evaluate(() => {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'none';
            const overlay = document.getElementById('welcomeOverlay');
            if (overlay) overlay.style.display = 'none';
        });

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
            try { await page.close(); } catch {}
        }
    }
});

app.get('/health', async (req, res) => {
    const b = await getBrowser();
    if (b && b.connected) {
        res.json({status: 'ok'});
    } else {
        res.status(503).json({status: 'browser down'});
    }
});

app.listen(PORT, async () => {
    console.log(`Screenshot service listening on port ${PORT}`);
    await launchBrowser();
});
