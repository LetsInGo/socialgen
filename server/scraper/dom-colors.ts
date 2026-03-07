import type { Page } from "puppeteer-core";

export interface DomColorEntry {
  hex: string;
  source: string;
  weight: number;
  area: number;
}

export interface DomExtractionResult {
  colors: DomColorEntry[];
  metadata: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    themeColor: string;
    keywords: string;
    bodyText: string;
    cssVariables: Array<{ name: string; value: string }>;
  };
}

const DOM_EXTRACTION_SCRIPT = `
(() => {
  const rgbToHex = (r, g, b) => {
    return "#" + [r, g, b]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("");
  };

  const parseColor = (color) => {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
    const rgbaMatch = color.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/);
    if (rgbaMatch) {
      const alpha = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
      if (alpha < 0.1) return null;
      return rgbToHex(parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3]));
    }
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      return ("#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toLowerCase();
    }
    return null;
  };

  const viewportArea = window.innerWidth * window.innerHeight;
  const colors = [];

  const selectors = [
    { selector: 'nav, [role="navigation"]', weight: 3, label: "nav" },
    { selector: "header", weight: 3, label: "header" },
    { selector: '[class*="hero"], [class*="Hero"], [id*="hero"]', weight: 4, label: "hero" },
    { selector: '[class*="banner"], [class*="Banner"]', weight: 4, label: "banner" },
    { selector: '[class*="logo"], [class*="Logo"], [id*="logo"]', weight: 5, label: "logo" },
    { selector: '[class*="brand"], [class*="Brand"]', weight: 5, label: "brand" },
    { selector: 'button, [role="button"], .btn, [class*="cta"], [class*="CTA"]', weight: 4, label: "cta/button" },
    { selector: "a", weight: 2, label: "link" },
    { selector: "h1", weight: 3, label: "h1" },
    { selector: "h2, h3", weight: 2, label: "heading" },
  ];

  for (const item of selectors) {
    try {
      const els = document.querySelectorAll(item.selector);
      els.forEach(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const areaRatio = (rect.width * rect.height) / viewportArea;
        if (areaRatio < 0.0001 && rect.width < 2) return;

        const bg = parseColor(style.backgroundColor);
        if (bg) colors.push({ hex: bg, source: item.label + " bg", weight: item.weight, area: areaRatio });

        const fg = parseColor(style.color);
        if (fg) colors.push({ hex: fg, source: item.label + " text", weight: item.weight * 0.7, area: areaRatio * 0.5 });

        const bc = parseColor(style.borderColor);
        if (bc) colors.push({ hex: bc, source: item.label + " border", weight: item.weight * 0.3, area: areaRatio * 0.2 });
      });
    } catch(e) {}
  }

  try {
    const allVisible = document.querySelectorAll("div, section, main, aside, footer, span, p");
    let count = 0;
    for (let i = 0; i < allVisible.length && count < 200; i++) {
      const el = allVisible[i];
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const areaRatio = (rect.width * rect.height) / viewportArea;
      if (areaRatio < 0.005) continue;
      const bg = parseColor(style.backgroundColor);
      if (bg) { colors.push({ hex: bg, source: "element bg", weight: 1, area: areaRatio }); count++; }
    }
  } catch(e) {}

  const cssVariables = [];
  try {
    const rootStyles = document.documentElement.style;
    for (let i = 0; i < rootStyles.length; i++) {
      const name = rootStyles[i];
      if (name.startsWith("--")) {
        cssVariables.push({ name: name, value: rootStyles.getPropertyValue(name).trim() });
      }
    }
    const sheets = document.styleSheets;
    for (let s = 0; s < sheets.length && s < 10; s++) {
      try {
        const rules = sheets[s].cssRules;
        for (let r = 0; r < rules.length && r < 500; r++) {
          const rule = rules[r];
          if (rule.selectorText === ":root" || rule.selectorText === "html" || rule.selectorText === "body") {
            for (let p = 0; p < rule.style.length; p++) {
              const prop = rule.style[p];
              if (prop.startsWith("--")) {
                const val = rule.style.getPropertyValue(prop).trim();
                cssVariables.push({ name: prop, value: val });
                const parsed = parseColor(val);
                if (parsed) {
                  const isBrand = /brand|primary|secondary|accent|main|theme/i.test(prop);
                  colors.push({ hex: parsed, source: "css-var " + prop, weight: isBrand ? 5 : 2, area: 0 });
                }
              }
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  const getMeta = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute("content") || "").trim() : "";
  };

  const themeColor = getMeta('meta[name="theme-color"]');
  if (themeColor) {
    const parsed = parseColor(themeColor);
    if (parsed) colors.push({ hex: parsed, source: "meta theme-color", weight: 5, area: 0 });
  }
  const tileColor = getMeta('meta[name="msapplication-TileColor"]');
  if (tileColor) {
    const parsed = parseColor(tileColor);
    if (parsed) colors.push({ hex: parsed, source: "meta tile-color", weight: 4, area: 0 });
  }

  return {
    colors: colors,
    metadata: {
      title: document.title || "",
      description: getMeta('meta[name="description"]'),
      ogTitle: getMeta('meta[property="og:title"]'),
      ogDescription: getMeta('meta[property="og:description"]'),
      ogImage: getMeta('meta[property="og:image"]'),
      themeColor: themeColor,
      keywords: getMeta('meta[name="keywords"]'),
      bodyText: (document.body && document.body.innerText ? document.body.innerText.slice(0, 4000) : ""),
      cssVariables: cssVariables,
    },
  };
})()
`;

export async function extractDomColors(page: Page): Promise<DomExtractionResult> {
  return await page.evaluate(DOM_EXTRACTION_SCRIPT) as DomExtractionResult;
}
