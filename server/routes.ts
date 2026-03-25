import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenAI, Modality } from "@google/genai";
import { imageGenerationConfigSchema } from "@shared/schema";
import { z } from "zod";
import {
  launchAndNavigate,
  closeBrowser,
  extractDomColors,
  extractKeyImages,
  scoreAndRankColors,
} from "./scraper";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const INDUSTRY_MOTIFS: Record<string, string> = {
  "Technology / SaaS": "luminous gradient fields with depth, translucent glassy layers, fine geometric grids dissolving into atmosphere, cool precision aesthetic with faint digital pulse",
  "Cybersecurity": "deep moody surfaces with encrypted-texture undertones, dark reflective materials, hex-pattern atmospherics, vault-like gravity and controlled light",
  "Finance / Fintech": "polished stone and glass architecture, calm geometric rhythm, structured elegance with quiet authority, refined institutional atmosphere",
  "Healthcare / Biotech": "soft clinical luminosity, gentle organic curves and cellular bokeh, clean ethereal atmosphere, translucent layered depth with a sense of care",
  "Fashion / Luxury": "editorial studio atmosphere, fabric-like light falls, specular highlights on minimal surfaces, runway elegance with high-fashion restraint",
  "Food & Beverage": "warm appetizing glow, soft textural surfaces of ceramic and natural wood, steam-haze ambience, inviting and tactile warmth",
  "Education": "warm academic atmosphere, soft paper-like textures, gentle amber light, knowledge-rich depth with scholarly calm",
  "Real Estate": "architectural light and open space, clean structural lines, natural illumination through modern forms, aspirational spatial clarity",
  "Travel & Tourism": "sweeping atmospheric depth, golden-hour luminosity, horizon-line perspective, wanderlust-evoking sense of scale and possibility",
  "Sports & Fitness": "dynamic energy through motion-blur atmosphere, high-contrast bold geometry, stadium-glow intensity, kinetic power",
  "Creative / Design": "bold color-theory blocking, geometric interplay, creative studio energy, typographic-negative-space sensibility",
  "Music & Entertainment": "cinematic concert atmosphere, neon-glow halos, deep bokeh light fields, immersive stage-lit mood",
  "Non-profit / Social": "warm uplifting tones, hopeful ambient light, community-connected softness, gentle optimistic atmosphere",
  "Automotive": "sleek reflective surfaces, dramatic precision lighting, speed-implied aerodynamic forms, engineered elegance",
  "E-commerce / Retail": "clean lifestyle-photography atmosphere, modern product-showcase lighting, minimal aspirational space",
};

const STYLE_DESCRIPTORS: Record<string, string> = {
  photorealistic: "photorealistic photography, professional DSLR camera quality, natural depth of field, 8K ultra-high detail",
  illustration: "digital illustration, clean vector art style, bold colors, modern graphic design aesthetic",
  abstract: "abstract art, painterly brushstrokes, fluid forms and shapes, artistic interpretation, gallery-quality",
  minimalist: "minimalist design, clean lines, generous negative space, restrained color palette, Scandinavian aesthetic",
  gradient: "rich luminous color-field gradient, deep painterly wash of saturated hues, velvety soft transitions with dimensional atmospheric depth, ambient light bloom and glow, bold color-field abstraction with cinematic mood",
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

function getDimensionDescription(dimension: string, config: z.infer<typeof imageGenerationConfigSchema>): string | null {
  const motifs = INDUSTRY_MOTIFS[config.industry] || "professional, clean modern aesthetic";
  const styleDesc = STYLE_DESCRIPTORS[config.style] || "professional quality";

  switch (dimension) {
    case "industry":
      return `the aesthetic world of ${config.industry} — ${motifs}`;
    case "style":
      return `a ${styleDesc} visual treatment`;
    case "theme":
      return config.theme ? `the conceptual realm of ${config.theme}, with abstract symbolic imagery and patterns evoking this subject` : null;
    case "city":
      return config.city ? `the atmosphere of ${config.city} — its iconic skyline, landmarks, and cultural architecture (no readable text or signs)` : null;
    case "venue":
      return config.venue ? `the architectural character of ${config.venue} — its structural forms, facade geometry, and spatial presence` : null;
    case "graphic":
      return `the visual language and graphic style of the brand's current header imagery — its composition patterns, color blocking, and design motifs`;
    default:
      return null;
  }
}

function buildColorPhrase(config: z.infer<typeof imageGenerationConfigSchema>): string {
  const prominence = config.colorProminence ?? 50;
  const colors = [config.primaryColor];
  if (config.secondaryColor) colors.push(config.secondaryColor);
  if (config.accentColor) colors.push(config.accentColor);

  const primary = config.primaryColor;
  const secondary = config.secondaryColor || "darker tones";
  const accent = config.accentColor || "lighter highlights";

  if (prominence <= 20) {
    return `with a subtle wash of ${colors.join(", ")} as a gentle undertone beneath the composition`;
  } else if (prominence <= 40) {
    return `rendered in tones that echo ${primary}, with ${secondary} adding quiet depth and ${accent} as a soft accent`;
  } else if (prominence <= 60) {
    return `built around the palette of ${primary} as the dominant hue, ${secondary} providing structural depth, and ${accent} as deliberate highlights`;
  } else if (prominence <= 80) {
    return `dominated by ${primary} with bold ${secondary} contrast and ${accent} punctuating key areas — the color palette is a defining feature`;
  }
  return `defined entirely by ${primary} as the overwhelming color presence, ${secondary} as dramatic counterpoint, and ${accent} as vivid sparks — color IS the composition`;
}

function buildPrompt(config: z.infer<typeof imageGenerationConfigSchema>): string {
  const ratioLabel = ASPECT_RATIO_LABELS[config.aspectRatio] || config.aspectRatio;

  const validDims = ["industry", "theme", "city", "venue", "graphic"];
  const seen = new Set<string>();
  const normalizeTier = (arr: string[] | undefined, fallback: string[]): string[] => {
    const result: string[] = [];
    if (arr) {
      for (const v of arr) {
        if (validDims.includes(v) && !seen.has(v)) { seen.add(v); result.push(v); }
      }
    }
    if (result.length === 0) {
      for (const fb of fallback) {
        if (!seen.has(fb)) { seen.add(fb); result.push(fb); break; }
      }
    }
    return result;
  };
  const normPrimary = normalizeTier(config.focusPrimary, ["industry"]);
  const normSecondary = normalizeTier(config.focusSecondary, []);
  const normTertiary = normalizeTier(config.focusTertiary, []);

  const getTierDescs = (dims: string[]): string[] =>
    dims.map((d) => getDimensionDescription(d, config)).filter((d): d is string => d !== null);

  const primaryDescs = getTierDescs(normPrimary);
  const secondaryDescs = getTierDescs(normSecondary);
  const tertiaryDescs = getTierDescs(normTertiary);

  const colorPhrase = buildColorPhrase(config);

  let sceneParts: string[] = [];

  const styleDesc = STYLE_DESCRIPTORS[config.style] || "professional quality";

  sceneParts.push(`Create a single, cohesive production-ready social media background image rendered as ${styleDesc}.`);

  if (primaryDescs.length > 0) {
    sceneParts.push(`The image is grounded in ${primaryDescs.join(", interwoven with ")}. This is the dominant visual identity — it defines the scene's character, atmosphere, and spatial feel.`);
  }

  if (secondaryDescs.length > 0) {
    sceneParts.push(`Supporting this, the scene draws from ${secondaryDescs.join(" and ")}, which shapes the mood and adds atmospheric richness without competing for attention.`);
  }

  if (tertiaryDescs.length > 0) {
    sceneParts.push(`As a faint background influence, ${tertiaryDescs.join(" and ")} adds the subtlest textural detail — barely perceptible but enriching the depth.`);
  }

  sceneParts.push(`The entire composition is ${colorPhrase}.`);

  sceneParts.push(`CRITICAL: All elements must feel like parts of ONE unified scene — integrated through shared lighting, atmosphere, and color temperature. Nothing should feel placed on top or collaged. Every visual element should emerge naturally from the same world.`);

  if (config.customPrompt) {
    sceneParts.push(`Additional atmosphere: ${config.customPrompt}.`);
  }

  sceneParts.push(`Composition: Design for text overlay on the left and space for a headshot on the right — leave generous negative space in the upper-center and lower regions for headlines. Focal interest sits at bottom-right or bottom-left, not center.`);

  sceneParts.push(`Constraints: No text, no letters, no numbers, no logos, no watermarks, no readable signage. Clean export-ready background. Professional and polished.`);

  sceneParts.push(`Format: ${ratioLabel}.`);

  return sceneParts.join("\n\n");
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

      if (!isUrlSafe(normalizedUrl)) {
        return res.status(400).json({ error: "URL must be a public website (http or https)" });
      }

      let browserResult;
      try {
        browserResult = await launchAndNavigate(normalizedUrl);
      } catch (err: any) {
        return res.status(400).json({ error: `Could not load website: ${err.message}` });
      }

      try {
        const [domResult, keyImages] = await Promise.all([
          extractDomColors(browserResult.page),
          extractKeyImages(browserResult.page, browserResult.screenshot, normalizedUrl),
        ]);

        const scoredColors = scoreAndRankColors(domResult.colors);

        const colorListText = scoredColors
          .slice(0, 20)
          .map((c, i) => `${i + 1}. ${c.hex} (score: ${c.score.toFixed(1)}, found in: ${c.sources.join(", ")})`)
          .join("\n");

        const brandCssVars = domResult.metadata.cssVariables
          .filter((v) => /brand|primary|secondary|accent|main|theme/i.test(v.name))
          .map((v) => `${v.name}: ${v.value}`)
          .join(", ");

        const textContext = `URL: ${normalizedUrl}
Title: ${domResult.metadata.title}
OG Title: ${domResult.metadata.ogTitle}
Description: ${domResult.metadata.description}
OG Description: ${domResult.metadata.ogDescription}
Keywords: ${domResult.metadata.keywords}
Theme Color (meta): ${domResult.metadata.themeColor || "none"}

Top colors extracted from rendered page (scored by importance — logo, nav, hero, CTA elements weighted highest):
${colorListText}

${brandCssVars ? `Brand-related CSS variables: ${brandCssVars}` : ""}

Page text (first 3000 chars): ${domResult.metadata.bodyText.slice(0, 3000)}`;

        const parts: any[] = [];

        for (const img of keyImages) {
          // SVG is not supported by Gemini vision — skip it (it's only used as a UI overlay)
          if (img.mimeType === "image/svg+xml") continue;
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }

        const analysisPrompt = `You are a brand identity expert analyzing a website to extract its core brand color palette and details for generating social media background images.

You have been given:
1. A screenshot of the website (look at the actual visual appearance)
${keyImages.length > 1 ? `2. ${keyImages.length - 1} additional image(s) from the site (logo, OG image, etc.)` : ""}
3. Text data including scored colors extracted from the rendered DOM

IMPORTANT: LOOK at the screenshot and images carefully. The brand's true colors are most visible in:
- The hero/banner area
- The logo
- Navigation bar
- Call-to-action buttons
- Overall color scheme visible in the screenshot

Cross-reference what you SEE in the images with the scored color list below.

---
${textContext}
---

Respond ONLY with valid JSON (no markdown, no code fences):

{
  "eventName": "name of the event or brand",
  "industry": "one of: ${INDUSTRIES_LIST.join(", ")}",
  "style": "one of: ${STYLES_LIST.join(", ")} — pick the one that best matches the event's visual identity",
  "primaryColor": "hex color — the dominant brand color (most prominent in logo, hero, and overall visual identity)",
  "primaryConfidence": 0-100,
  "secondaryColor": "hex color — a complementary or supporting brand color",
  "secondaryConfidence": 0-100,
  "accentColor": "hex color — highlight or accent color used for CTAs, links, or emphasis",
  "accentConfidence": 0-100,
  "eventDates": "the dates of the event in a short human-readable format (e.g. 'June 10-12, 2025', 'March 3, 2025'). Empty string if not found.",
  "city": "the city or location where the event takes place (empty string if not found)",
  "venue": "the specific venue or conference center name (e.g. 'Moscone Center', 'Las Vegas Convention Center'). Empty string if not found.",
  "theme": "the core topic or subject matter of the event/brand (e.g. 'Artificial Intelligence & Machine Learning', 'Sustainable Finance', 'Developer Tools'). NOT the visual style — this is the conceptual theme. Empty string if unclear.",
  "customPrompt": "a brief 1-2 sentence description of the event's visual mood, theme, or atmosphere",
  "summary": "a 1-2 sentence summary of what this event/brand is about"
}

Rules:
- For colors, prioritize what you can SEE in the screenshot and images over the CSS color list.
- The CSS scored list is a helpful reference but the visual analysis should take priority.
- Avoid generic colors (#000, #fff, #333) unless they are genuinely part of the brand identity (e.g., a luxury brand with a black-and-white scheme).
- Pick distinctive, on-brand colors that a designer would recognize as "this brand's colors".
- Confidence should reflect how certain you are that each color truly represents the brand.`;

        parts.push({ text: analysisPrompt });

        let response;
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts }],
          });
        } catch (apiErr: any) {
          const apiMsg = apiErr?.message || "";
          if (apiMsg.includes("INVALID_ARGUMENT") && keyImages.length > 1) {
            console.log("[scraper] Gemini rejected images, retrying with screenshot only...");
            const screenshotOnlyParts = [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: keyImages[0].base64,
                },
              },
              { text: analysisPrompt },
            ];
            response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: screenshotOnlyParts }],
            });
          } else {
            throw apiErr;
          }
        }

        const text = response.text || "";

        let parsed: any;
        try {
          const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const braceStart = cleaned.indexOf("{");
          const braceEnd = cleaned.lastIndexOf("}");
          if (braceStart === -1 || braceEnd === -1 || braceEnd <= braceStart) {
            return res.status(500).json({ error: "Could not extract structured data from this website. Try a different URL." });
          }
          parsed = JSON.parse(cleaned.substring(braceStart, braceEnd + 1));
        } catch {
          return res.status(500).json({ error: "Could not parse analysis result. Try again." });
        }

        const screenshotBase64 = browserResult.screenshot.toString("base64");

        const logoImage = keyImages.find((img) => img.source === "logo" || img.source === "apple-touch-icon" || img.source === "favicon");
        const logoData = logoImage
          ? { base64: logoImage.base64, mimeType: logoImage.mimeType }
          : null;

        const result = {
          eventName: typeof parsed.eventName === "string" ? parsed.eventName : "Unknown Event",
          industry: INDUSTRIES_LIST.includes(parsed.industry) ? parsed.industry : "Technology / SaaS",
          style: STYLES_LIST.includes(parsed.style) ? parsed.style : "gradient",
          primaryColor: typeof parsed.primaryColor === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.primaryColor) ? parsed.primaryColor : "#0A84FF",
          primaryConfidence: typeof parsed.primaryConfidence === "number" ? Math.min(100, Math.max(0, parsed.primaryConfidence)) : 50,
          secondaryColor: typeof parsed.secondaryColor === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.secondaryColor) ? parsed.secondaryColor : "#0B1F3B",
          secondaryConfidence: typeof parsed.secondaryConfidence === "number" ? Math.min(100, Math.max(0, parsed.secondaryConfidence)) : 50,
          accentColor: typeof parsed.accentColor === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.accentColor) ? parsed.accentColor : "#64D2FF",
          accentConfidence: typeof parsed.accentConfidence === "number" ? Math.min(100, Math.max(0, parsed.accentConfidence)) : 50,
          eventDates: typeof parsed.eventDates === "string" ? parsed.eventDates : "",
          city: typeof parsed.city === "string" ? parsed.city : "",
          venue: typeof parsed.venue === "string" ? parsed.venue : "",
          theme: typeof parsed.theme === "string" ? parsed.theme : "",
          customPrompt: typeof parsed.customPrompt === "string" ? parsed.customPrompt : "",
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          screenshot: screenshotBase64,
          logo: logoData,
          fontFamily: domResult.metadata.fontFamily || null,
          allColors: scoredColors.slice(0, 10).map((c) => ({
            hex: c.hex,
            score: Math.round(c.score * 10) / 10,
            sources: c.sources,
          })),
        };

        res.json(result);
      } finally {
        await closeBrowser(browserResult.browser);
      }
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
