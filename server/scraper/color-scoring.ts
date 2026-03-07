import type { DomColorEntry } from "./dom-colors";

export interface ScoredColor {
  hex: string;
  score: number;
  count: number;
  sources: string[];
  totalArea: number;
}

const IGNORABLE_COLORS = new Set([
  "#000000", "#ffffff", "#333333", "#666666", "#999999",
  "#cccccc", "#f5f5f5", "#eeeeee", "#dddddd", "#e5e5e5",
  "#f0f0f0", "#fafafa", "#f8f8f8", "#e0e0e0", "#d4d4d4",
  "#a3a3a3", "#737373", "#525252", "#404040", "#262626",
  "#171717", "#0a0a0a", "#111111", "#222222", "#444444",
  "#555555", "#777777", "#888888", "#aaaaaa", "#bbbbbb",
]);

const HIGH_VALUE_SOURCES = new Set([
  "logo", "brand", "meta theme-color", "meta tile-color",
]);

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function isGrayish(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) < 15;
}

export function scoreAndRankColors(entries: DomColorEntry[]): ScoredColor[] {
  const buckets = new Map<string, { score: number; count: number; sources: Set<string>; totalArea: number }>();

  for (const entry of entries) {
    const hex = entry.hex.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) continue;

    const existing = buckets.get(hex);
    if (existing) {
      existing.score += entry.weight;
      existing.count += 1;
      existing.sources.add(entry.source);
      existing.totalArea += entry.area;
    } else {
      buckets.set(hex, {
        score: entry.weight,
        count: 1,
        sources: new Set([entry.source]),
        totalArea: entry.area,
      });
    }
  }

  const merged: ScoredColor[] = [];
  const processed = new Set<string>();

  const sortedEntries = Array.from(buckets.entries()).sort(
    (a, b) => b[1].score - a[1].score
  );

  for (const [hex, data] of sortedEntries) {
    if (processed.has(hex)) continue;
    processed.add(hex);

    let mergedScore = data.score + data.count * 0.5 + data.totalArea * 10;
    let mergedCount = data.count;
    const mergedSources = new Set(data.sources);
    let mergedArea = data.totalArea;

    for (const [otherHex, otherData] of buckets.entries()) {
      if (processed.has(otherHex)) continue;
      if (colorDistance(hex, otherHex) < 30) {
        processed.add(otherHex);
        mergedScore += otherData.score + otherData.count * 0.5 + otherData.totalArea * 10;
        mergedCount += otherData.count;
        otherData.sources.forEach((s) => mergedSources.add(s));
        mergedArea += otherData.totalArea;
      }
    }

    merged.push({
      hex,
      score: mergedScore,
      count: mergedCount,
      sources: Array.from(mergedSources),
      totalArea: mergedArea,
    });
  }

  const hasHighValueSource = (sources: string[]): boolean =>
    sources.some((s) => {
      for (const hvs of HIGH_VALUE_SOURCES) {
        if (s.includes(hvs)) return true;
      }
      return false;
    });

  const scored = merged.map((c) => {
    let finalScore = c.score;

    if (IGNORABLE_COLORS.has(c.hex) && !hasHighValueSource(c.sources)) {
      finalScore *= 0.1;
    } else if (isGrayish(c.hex) && !hasHighValueSource(c.sources)) {
      finalScore *= 0.3;
    }

    if (hasHighValueSource(c.sources)) {
      finalScore *= 2;
    }

    if (c.sources.some((s) => s.startsWith("css-var") && /brand|primary|accent|main|theme/i.test(s))) {
      finalScore *= 2.5;
    }

    return { ...c, score: finalScore };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 25);
}
