import { type User, type InsertUser, type GeneratedImage, type InsertGeneratedImage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveGeneratedImage(image: InsertGeneratedImage): Promise<GeneratedImage>;
  getGeneratedImage(id: number): Promise<GeneratedImage | undefined>;
  getRecentImages(limit: number): Promise<GeneratedImage[]>;
  deleteGeneratedImage(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private images: Map<number, GeneratedImage>;
  private nextImageId: number;

  constructor() {
    this.users = new Map();
    this.images = new Map();
    this.nextImageId = 1;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async saveGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const id = this.nextImageId++;
    const image: GeneratedImage = {
      id,
      prompt: insertImage.prompt,
      imageData: insertImage.imageData,
      mimeType: insertImage.mimeType ?? "image/png",
      config: insertImage.config,
      createdAt: new Date(),
    };
    this.images.set(id, image);
    return image;
  }

  async getGeneratedImage(id: number): Promise<GeneratedImage | undefined> {
    return this.images.get(id);
  }

  async getRecentImages(limit: number): Promise<GeneratedImage[]> {
    return Array.from(this.images.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async deleteGeneratedImage(id: number): Promise<void> {
    this.images.delete(id);
  }
}

export const storage = new MemStorage();
