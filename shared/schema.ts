import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const generatedImages = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  imageData: text("image_data").notNull(),
  mimeType: text("mime_type").notNull().default("image/png"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({
  id: true,
  createdAt: true,
});

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;

export const imageGenerationConfigSchema = z.object({
  industry: z.string().min(1, "Industry is required"),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:5", "3:2", "2:3", "21:9"]),
  style: z.enum(["photorealistic", "illustration", "abstract", "minimalist", "gradient", "editorial"]),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().optional().default(""),
  accentColor: z.string().optional().default(""),
  focusPrimary: z.string().optional().default("industry"),
  focusSecondary: z.string().optional().default("style"),
  focusTertiary: z.string().optional().default(""),
  colorProminence: z.number().min(0).max(100).optional().default(50),
  city: z.string().optional().default(""),
  venue: z.string().optional().default(""),
  theme: z.string().optional().default(""),
  customPrompt: z.string().optional().default(""),
  model: z.enum(["gemini-2.5-flash-image", "gemini-3-pro-image-preview"]).default("gemini-2.5-flash-image"),
});

export type ImageGenerationConfig = z.infer<typeof imageGenerationConfigSchema>;
