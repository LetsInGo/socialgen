import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenAI, Modality } from "@google/genai";
import { imageGenerationConfigSchema } from "@shared/schema";
import { z } from "zod";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const INDUSTRY_MOTIFS: Record<string, string> = {
  "Technology / SaaS": "abstract network lines, soft gradient mesh, glassmorphism panels, thin circuit traces, clean UI grid, futuristic data visualization",
  "Cybersecurity": "subtle hex-grid overlay, encrypted glyph texture (abstract, not readable), dark glossy materials, secure vault lighting, deep contrast panels",
  "Finance / Fintech": "calm geometric grid, subtle market-chart waves (non-numeric), polished stone and glass textures, architectural columns, clean serif typography feel",
  "Healthcare / Biotech": "soft clinical light, bokeh microscopy shapes, clean white teal palette, gentle organic curves, molecular structures, calm medical aesthetic",
  "Fashion / Luxury": "editorial studio backdrop, fabric folds with specular highlights, runway light bars, minimal set design, high-fashion negative space",
  "Food & Beverage": "macro food texture, soft steam haze, ceramic and wood surfaces, warm appetizing light, bokeh café ambience",
  "Education": "open books and soft paper textures, warm academic tones, subtle pencil sketch elements, warm library light",
  "Real Estate": "architectural photography feel, clean building facades, natural light and open space, minimalist interior aesthetic",
  "Travel & Tourism": "sweeping landscape vistas, golden hour glow, atmospheric haze and depth, wanderlust negative space",
  "Sports & Fitness": "dynamic motion blur, high contrast athletic energy, bold geometric shapes, stadium lighting",
  "Creative / Design": "geometric patterns and color theory, typographic negative space, creative studio vibe, bold color blocking",
  "Music & Entertainment": "concert stage lights, neon glow, bokeh light dots, cinematic mood, deep atmosphere",
  "Non-profit / Social": "warm human tones, uplifting color palette, community and connection motifs, hopeful lighting",
  "Automotive": "sleek metallic surfaces, dramatic studio lighting, speed lines, precision engineering aesthetic",
  "E-commerce / Retail": "clean product showcase lighting, minimal white space, modern lifestyle photography feel",
};

const STYLE_DESCRIPTORS: Record<string, string> = {
  photorealistic: "photorealistic photography, professional DSLR camera quality, natural depth of field, 8K ultra-high detail",
  illustration: "digital illustration, clean vector art style, bold colors, modern graphic design aesthetic",
  abstract: "abstract art, painterly brushstrokes, fluid forms and shapes, artistic interpretation, gallery-quality",
  minimalist: "minimalist design, clean lines, generous negative space, restrained color palette, Scandinavian aesthetic",
  gradient: "smooth gradient field, color wash, soft transitions, luminous color blending, atmospheric glow",
  editorial: "editorial photography style, magazine layout, high production value, fashion-forward composition",
};

const ASPECT_RATIO_LABELS: Record<string, string> = {
  "1:1": "1:1 aspect ratio, square format, Instagram post",
  "16:9": "16:9 aspect ratio, widescreen backdrop, YouTube thumbnail or LinkedIn banner",
  "9:16": "9:16 aspect ratio, vertical social post, Instagram Story or TikTok background",
  "4:5": "4:5 aspect ratio, portrait format, Instagram portrait post",
  "3:2": "3:2 aspect ratio, landscape format, Twitter banner",
  "2:3": "2:3 aspect ratio, portrait format, Pinterest pin",
  "21:9": "21:9 aspect ratio, ultra-wide cinematic format, website hero banner",
};

function buildPrompt(config: z.infer<typeof imageGenerationConfigSchema>): string {
  const motifs = INDUSTRY_MOTIFS[config.industry] || "abstract professional background, clean modern aesthetic";
  const styleDesc = STYLE_DESCRIPTORS[config.style] || "professional quality";
  const ratioLabel = ASPECT_RATIO_LABELS[config.aspectRatio] || config.aspectRatio;

  const colorSection = [
    `primary color ~70% dominance: ${config.primaryColor}`,
    config.secondaryColor ? `secondary color ~20%: ${config.secondaryColor}` : null,
    config.accentColor ? `accent color ~10%: ${config.accentColor}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const citySection = config.city
    ? `Set against ${config.city} - use one unmistakable landmark or skyline silhouette, atmospheric lighting and cultural architecture cues, no readable text or signs.`
    : "";

  const customSection = config.customPrompt
    ? `Additional details: ${config.customPrompt}.`
    : "";

  return `Create a production-ready social media background image. ${styleDesc}.

Industry theme: ${config.industry} — incorporate subtle motifs of ${motifs}.

Color palette: ${colorSection}. The background field should reflect these colors with large gradient canvas areas.

Composition: Design for text overlay use — leave generous negative space in the upper-center and lower regions where headlines and body copy will be placed. Use depth-of-field or softness to ensure text readability areas. Focal interest should sit at bottom-right or bottom-left corner, not center.

${citySection}

${customSection}

Constraints: No text, no letters, no numbers, no logos, no watermarks, no readable signage. Clean export-ready background. Professional and polished.

Format: ${ratioLabel}.`.trim();
}

function isUrlSafe(urlString: string): boolean {
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

async function fetchWebsiteContent(url: string): Promise<string> {
  if (!isUrlSafe(url)) {
    throw new Error("URL must be a public website (http or https)");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NanoBananaBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(`Website returned status ${response.status}`);
    }
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
    const description = metaDesc ? metaDesc[1].trim() : "";
    const metaKw = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([\s\S]*?)["']/i);
    const keywords = metaKw ? metaKw[1].trim() : "";
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i);
    const ogImg = ogImage ? ogImage[1].trim() : "";
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
    const ogT = ogTitle ? ogTitle[1].trim() : "";
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
    const ogD = ogDesc ? ogDesc[1].trim() : "";

    const colorMatches = new Set<string>();
    const hexPattern = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    let match;
    while ((match = hexPattern.exec(html)) !== null && colorMatches.size < 30) {
      colorMatches.add(match[0]);
    }

    const rgbPattern = /rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
    while ((match = rgbPattern.exec(html)) !== null && colorMatches.size < 40) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      colorMatches.add(`#${r}${g}${b}`);
    }

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const bodyText = stripped.slice(0, 4000);

    return `URL: ${url}
Title: ${title}
OG Title: ${ogT}
Description: ${description}
OG Description: ${ogD}
Keywords: ${keywords}
OG Image: ${ogImg}
Colors found in CSS/HTML: ${Array.from(colorMatches).join(", ")}
Page text (first 4000 chars): ${bodyText}`;
  } finally {
    clearTimeout(timeout);
  }
}

const INDUSTRIES_LIST = Object.keys(INDUSTRY_MOTIFS);
const STYLES_LIST = ["photorealistic", "illustration", "abstract", "minimalist", "gradient", "editorial"];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/scrape-event", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = "https://" + normalizedUrl;
      }

      let websiteContent: string;
      try {
        websiteContent = await fetchWebsiteContent(normalizedUrl);
      } catch (err: any) {
        return res.status(400).json({ error: `Could not fetch website: ${err.message}` });
      }

      const analysisPrompt = `You are analyzing an event or brand website to extract visual design parameters for generating a social media background image.

Here is the website content:
---
${websiteContent}
---

Based on this website, extract the following and respond ONLY with valid JSON (no markdown, no code fences):

{
  "eventName": "name of the event or brand",
  "industry": "one of: ${INDUSTRIES_LIST.join(", ")}",
  "style": "one of: ${STYLES_LIST.join(", ")} — pick the one that best matches the event's visual identity",
  "primaryColor": "hex color — the dominant brand/event color from the website",
  "secondaryColor": "hex color — a complementary dark or contrasting color from the website",
  "accentColor": "hex color — a highlight or accent color from the website",
  "city": "the city or location where the event takes place (empty string if not found)",
  "customPrompt": "a brief 1-2 sentence description of the event's visual mood, theme, or atmosphere that should influence the background image",
  "summary": "a 1-2 sentence summary of what this event/brand is about"
}

Rules:
- For colors, prefer actual brand colors found on the site. Avoid common CSS defaults (#000, #fff, #333, #666, etc). Pick distinctive, on-brand colors.
- For industry, pick the closest match from the provided list.
- For style, consider the website's design language (corporate = minimalist, creative = abstract, etc).
- If you can't determine a field, make your best reasonable guess based on context.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
      });

      const text = response.text || "";
      const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: "Could not extract structured data from this website. Try a different URL." });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(500).json({ error: "Could not parse analysis result. Try again." });
      }

      const result = {
        eventName: typeof parsed.eventName === "string" ? parsed.eventName : "Unknown Event",
        industry: INDUSTRIES_LIST.includes(parsed.industry) ? parsed.industry : "Technology / SaaS",
        style: STYLES_LIST.includes(parsed.style) ? parsed.style : "gradient",
        primaryColor: typeof parsed.primaryColor === "string" && /^#[0-9a-fA-F]{3,6}$/.test(parsed.primaryColor) ? parsed.primaryColor : "#0A84FF",
        secondaryColor: typeof parsed.secondaryColor === "string" && /^#[0-9a-fA-F]{3,6}$/.test(parsed.secondaryColor) ? parsed.secondaryColor : "#0B1F3B",
        accentColor: typeof parsed.accentColor === "string" && /^#[0-9a-fA-F]{3,6}$/.test(parsed.accentColor) ? parsed.accentColor : "#64D2FF",
        city: typeof parsed.city === "string" ? parsed.city : "",
        customPrompt: typeof parsed.customPrompt === "string" ? parsed.customPrompt : "",
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
      };

      res.json(result);
    } catch (error: any) {
      console.error("Scrape error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze website" });
    }
  });

  app.post("/api/generate", async (req: Request, res: Response) => {
    try {
      const config = imageGenerationConfigSchema.parse(req.body);
      const prompt = buildPrompt(config);

      const response = await ai.models.generateContent({
        model: config.model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

      if (!imagePart?.inlineData?.data) {
        return res.status(500).json({ error: "No image was generated. Please try again." });
      }

      const mimeType = imagePart.inlineData.mimeType || "image/png";
      const imageData = imagePart.inlineData.data;

      const saved = await storage.saveGeneratedImage({
        prompt,
        imageData,
        mimeType,
        config,
      });

      res.json({
        id: saved.id,
        imageData,
        mimeType,
        prompt,
        createdAt: saved.createdAt,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid configuration", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  app.get("/api/history", async (req: Request, res: Response) => {
    try {
      const images = await storage.getRecentImages(20);
      res.json(images);
    } catch (error: any) {
      console.error("History error:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.get("/api/history/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const image = await storage.getGeneratedImage(id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(image);
    } catch (error: any) {
      console.error("Get image error:", error);
      res.status(500).json({ error: "Failed to fetch image" });
    }
  });

  app.delete("/api/history/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await storage.deleteGeneratedImage(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  app.get("/api/prompt-preview", async (req: Request, res: Response) => {
    try {
      const config = imageGenerationConfigSchema.parse(req.query);
      const prompt = buildPrompt(config);
      res.json({ prompt });
    } catch (error: any) {
      res.status(400).json({ error: "Invalid configuration" });
    }
  });

  return httpServer;
}
