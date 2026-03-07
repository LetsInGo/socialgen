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

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--no-first-run",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function createBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: getChromiumPath(),
    headless: true,
    args: BROWSER_ARGS,
  });
}

async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(USER_AGENT);
  return page;
}

function isRetryableError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("frame was detached") ||
    lower.includes("navigation timeout") ||
    lower.includes("timeout exceeded") ||
    lower.includes("err_aborted") ||
    lower.includes("connection closed")
  );
}

export interface BrowserResult {
  screenshot: Buffer;
  page: Page;
  browser: Browser;
}

export async function launchAndNavigate(url: string): Promise<BrowserResult> {
  let browser = await createBrowser();

  try {
    const page = await setupPage(browser);

    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 20000,
      });
    } catch (navErr: any) {
      const msg = navErr?.message || "";
      if (!isRetryableError(msg)) throw navErr;

      console.log(`[scraper] Initial navigation failed (${msg.slice(0, 80)}), retrying with fresh browser...`);

      try { await browser.close(); } catch {}

      browser = await createBrowser();
      const freshPage = await setupPage(browser);

      await freshPage.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await freshPage.evaluate("new Promise(r => setTimeout(r, 3000))");

      const screenshot = await freshPage.screenshot({
        type: "png",
        fullPage: false,
      }) as Buffer;

      return { screenshot, page: freshPage, browser };
    }

    await page.evaluate("new Promise(r => setTimeout(r, 1500))");

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    }) as Buffer;

    return { screenshot, page, browser };
  } catch (err) {
    try { await browser.close(); } catch {}
    throw err;
  }
}

export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch {}
}
