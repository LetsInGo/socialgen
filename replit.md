# Nano Banana Studio

A social media background image generator powered by Google's Gemini image generation models (Nano Banana family).

## Overview

Users configure generation parameters (industry, visual style, aspect ratio, color palette, city, custom instructions) and generate production-ready social media background images optimized for text overlay.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui components
- **Backend**: Express.js server
- **AI**: Google Gemini image generation via Replit AI Integrations (no API key needed)
- **Storage**: In-memory (MemStorage) — images stored as base64 in server memory
- **Browser automation**: Puppeteer-core + system Chromium for headless website rendering

## Key Features

- **Preview-dominant layout**: Large preview hero panel (left, ~65%) with compact config panel (right, ~35%). Preview is the focal point, not the form.
- **Progressive disclosure**: Config sections (Industry, Colors, Fine-Tune, Advanced) collapse behind toggles. Only URL input, style picker, and Generate button visible above the fold.
- **Skeleton shimmer loading**: Premium shimmer animation in preview area during generation. Error states shown inline in preview with retry buttons.
- **Contextual Pro upsell**: After generating with Fast model, a subtle banner suggests trying Pro — not buried in the form.
- **Inline error states**: URL analysis failures and generation errors shown in context with actionable "Try again" buttons, not just toast notifications.
- **Dark mode default**: New users see dark mode by default. Light mode available via toggle. Theme persisted in localStorage.
- **Headless browser scraping**: Uses Puppeteer + Chromium to render JavaScript-heavy sites, extract computed styles from the live DOM, take screenshots, and fetch key images (OG image, logo, favicon)
- **Multimodal AI analysis**: Sends page screenshots + key images + scored color data to Gemini for visual brand color identification — sees the actual page, not just raw HTML
- **Color scoring engine**: Weights colors by element importance (logo 5x, hero/CTA 4x, nav/header 3x, headings 2x, body 1x), merges near-duplicates, filters common defaults, and highlights CSS variables with brand-related names
- **Smart prompt builder**: Automatically constructs detailed, structured prompts from user inputs
- **Industry motifs**: 15 industries with curated visual vocabulary
- **Color palette**: 6 preset palettes + custom RGB/hex color pickers + per-color weight sliders (0-100%) + arrow buttons to reorder colors (moving a color up gives it a higher weight position)
- **Prompt influence sliders**: Industry motifs, visual style, and city/location intensity (0-100, mapped to language levels from "barely perceptible" to "overwhelming/maximalist")
- **Aspect ratios**: 7 standard social ratios in a compact dropdown (with platform labels like "YouTube / LinkedIn", "Story / Reel")
- **Visual styles**: 6 styles in a compact dropdown (photorealistic, illustration, abstract, minimalist, gradient, editorial)
- **Logo overlay**: Draggable event logo extracted from scraping, positioned top-left by default; composited into download; can be hidden/shown
- **Model selection**: Nano Banana (fast) vs Nano Banana Pro (high fidelity) — in Advanced section, with contextual upsell post-generation
- **Event theme**: Extracted from scraping (e.g. "AI & Machine Learning", "Sustainable Finance") — adds conceptual visual imagery with intensity control
- **Venue**: Extracted from scraping (e.g. "Moscone Center") — adds venue architecture with intensity control
- **City/location**: Optional city backdrop with cultural cues and intensity control
- **Generation history**: Browse, preview, download, and delete past generations
- **Prompt reveal**: "View prompt used" toggle beneath preview, shows the exact prompt sent to AI with copy button

## Pages

- `/` — Generator page (main)
- `/history` — Generation history gallery

## API Endpoints

- `POST /api/scrape-event` — Scrape a website via headless browser, extract DOM colors, take screenshot, fetch key images, then send all to Gemini multimodal for brand color analysis. Returns colors with confidence scores and screenshot.
- `POST /api/generate` — Generate a new image (accepts ImageGenerationConfig)
- `GET /api/history` — Get recent 20 generated images
- `GET /api/history/:id` — Get a specific image
- `DELETE /api/history/:id` — Delete an image

## Scraper Architecture (`server/scraper/`)

- `browser.ts` — Launches headless Chromium, navigates to URL, takes viewport screenshot. Includes automatic retry with fresh browser instance on navigation failures (frame detachment, timeouts, connection closed) using `domcontentloaded` fallback strategy
- `dom-colors.ts` — Runs `page.evaluate()` to extract computed styles from high-priority elements (nav, header, hero, logo, CTA, headings), CSS variables, and meta tags (theme-color)
- `image-colors.ts` — Identifies and fetches key images (OG image, logo, favicon, apple-touch-icon) for Gemini visual analysis
- `color-scoring.ts` — Scores, merges near-duplicate shades, filters generic defaults, and ranks colors by importance
- `index.ts` — Barrel exports

## Environment Variables

- `AI_INTEGRATIONS_GEMINI_API_KEY` — Provided by Replit AI Integrations
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Provided by Replit AI Integrations

## System Dependencies

- Chromium (discovered dynamically via `which chromium` or `CHROMIUM_PATH` env var)
- `puppeteer-core` npm package (uses system Chromium, no bundled browser)

## Models

- `gemini-2.5-flash-image` — Nano Banana (fast generation)
- `gemini-3-pro-image-preview` — Nano Banana Pro (high fidelity)
