import type { Page } from "puppeteer-core";

export interface KeyImage {
  base64: string;
  mimeType: string;
  source: string;
}

function isImageUrlSafe(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    const blocked = [
      "localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal",
      "169.254.169.254", "metadata", "10.", "172.16.", "172.17.", "172.18.",
      "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
      "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.",
    ];
    for (const b of blocked) {
      if (hostname === b || hostname.startsWith(b)) return false;
    }
    if (!hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

const IMAGE_URL_SCRIPT = `
(() => {
  const urls = [];

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute("content");
    if (content) urls.push({ url: content, source: "og-image", priority: 10 });
  }

  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage) {
    const content = twitterImage.getAttribute("content");
    if (content && !urls.some(u => u.url === content)) {
      urls.push({ url: content, source: "twitter-image", priority: 9 });
    }
  }

  const logoSelectors = [
    'img[class*="logo"]',
    'img[id*="logo"]',
    'img[alt*="logo" i]',
    '[class*="logo"] img',
    'header img',
    'nav img',
    '.navbar-brand img',
    'a[class*="brand"] img',
  ];

  for (const sel of logoSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.src && !urls.some(u => u.url === el.src)) {
        urls.push({ url: el.src, source: "logo", priority: 8 });
        break;
      }
    } catch(e) {}
  }

  const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouchIcon) {
    const href = appleTouchIcon.getAttribute("href");
    if (href) urls.push({ url: href, source: "apple-touch-icon", priority: 7 });
  }

  const favicon = document.querySelector('link[rel="icon"][sizes="32x32"], link[rel="icon"][type="image/png"], link[rel="shortcut icon"]');
  if (favicon) {
    const href = favicon.getAttribute("href");
    if (href && !urls.some(u => u.url === href)) {
      urls.push({ url: href, source: "favicon", priority: 6 });
    }
  }

  return urls.sort((a, b) => b.priority - a.priority).slice(0, 3);
})()
`;

export async function extractKeyImages(
  page: Page,
  screenshot: Buffer,
  baseUrl: string
): Promise<KeyImage[]> {
  const images: KeyImage[] = [];

  images.push({
    base64: screenshot.toString("base64"),
    mimeType: "image/png",
    source: "page-screenshot",
  });

  const imageUrls = await page.evaluate(IMAGE_URL_SCRIPT) as Array<{
    url: string;
    source: string;
    priority: number;
  }>;

  for (const imgInfo of imageUrls.slice(0, 2)) {
    try {
      let fullUrl = imgInfo.url;
      if (fullUrl.startsWith("//")) fullUrl = "https:" + fullUrl;
      else if (fullUrl.startsWith("/")) fullUrl = new URL(fullUrl, baseUrl).href;
      else if (!fullUrl.startsWith("http") && !fullUrl.startsWith("data:")) fullUrl = new URL(fullUrl, baseUrl).href;

      if (fullUrl.startsWith("data:")) {
        const match = fullUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          images.push({ base64: match[2], mimeType: match[1], source: imgInfo.source });
        }
        continue;
      }

      if (!isImageUrlSafe(fullUrl)) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(fullUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });
        if (resp.ok) {
          const contentType = resp.headers.get("content-type") || "image/png";
          if (contentType.startsWith("image/")) {
            const buffer = Buffer.from(await resp.arrayBuffer());
            if (buffer.length > 100 && buffer.length < 5_000_000) {
              images.push({
                base64: buffer.toString("base64"),
                mimeType: contentType.split(";")[0],
                source: imgInfo.source,
              });
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {}
  }

  return images;
}
