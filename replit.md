# Nano Banana Studio

A social media background image generator powered by Google's Gemini image generation models (Nano Banana family).

## Overview

Users configure generation parameters (industry, visual style, aspect ratio, color palette, city, custom instructions) and generate production-ready social media background images optimized for text overlay.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui components
- **Backend**: Express.js server
- **AI**: Google Gemini image generation via Replit AI Integrations (no API key needed)
- **Storage**: In-memory (MemStorage) — images stored as base64 in server memory

## Key Features

- **Smart prompt builder**: Automatically constructs detailed, structured prompts from user inputs
- **Industry motifs**: 15 industries with curated visual vocabulary
- **Color palette**: 6 preset palettes + custom RGB/hex color pickers
- **Aspect ratios**: 7 standard social ratios (1:1, 16:9, 9:16, 4:5, 3:2, 2:3, 21:9)
- **Visual styles**: 6 styles (photorealistic, illustration, abstract, minimalist, gradient, editorial)
- **Model selection**: Nano Banana (fast) vs Nano Banana Pro (high fidelity)
- **City/location**: Optional city backdrop with cultural cues
- **Generation history**: Browse, preview, download, and delete past generations
- **Dark/light mode**: Full theme toggle with persistence

## Pages

- `/` — Generator page (main)
- `/history` — Generation history gallery

## API Endpoints

- `POST /api/generate` — Generate a new image (accepts ImageGenerationConfig)
- `GET /api/history` — Get recent 20 generated images
- `GET /api/history/:id` — Get a specific image
- `DELETE /api/history/:id` — Delete an image

## Environment Variables

- `AI_INTEGRATIONS_GEMINI_API_KEY` — Provided by Replit AI Integrations
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Provided by Replit AI Integrations

## Models

- `gemini-2.5-flash-image` — Nano Banana (fast generation)
- `gemini-3-pro-image-preview` — Nano Banana Pro (high fidelity)
