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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
