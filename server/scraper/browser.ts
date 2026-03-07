import puppeteer from "puppeteer-core";
import type { Browser, Page } from "puppeteer-core";
import { execSync } from "child_process";

function findChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  const candidates = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  for (const cmd of candidates) {
    try {
      const path = execSync(`which ${cmd} 2>/dev/null`).toString().trim();
      if (path) return path;
    } catch {}
  }

  throw new Error("Chromium not found. Set CHROMIUM_PATH environment variable.");
}

let chromiumPath: string | null = null;

function getChromiumPath(): string {
  if (!chromiumPath) {
    chromiumPath = findChromiumPath();
  }
  return chromiumPath;
}

export interface BrowserResult {
  screenshot: Buffer;
  page: Page;
  browser: Browser;
}

export async function launchAndNavigate(url: string): Promise<BrowserResult> {
  const browser = await puppeteer.launch({
    executablePath: getChromiumPath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--no-first-run",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });

    await page.evaluate("new Promise(r => setTimeout(r, 1500))");

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    }) as Buffer;

    return { screenshot, page, browser };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch {}
}
