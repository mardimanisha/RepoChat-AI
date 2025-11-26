/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface GeminiMessageParams {
  system?: string;
  messages: Array<{ role: "user" | "model"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export class GeminiClient {
  private client: GoogleGenAI;
  private modelName: string;

  constructor(config: GeminiConfig) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required");
    }

    this.client = new GoogleGenAI({
      apiKey: config.apiKey,
    });
    this.modelName = config.model || "gemini-2.5-flash";
  }

  async generateContent(params: GeminiMessageParams): Promise<string> {
    try {
      const contents: Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }> = [];

      for (const msg of params.messages) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }

      const config: any = {
        systemInstruction: params.system || undefined,
        temperature: params.temperature || 0.7,
        maxOutputTokens: params.maxTokens || 1024,
      };

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: contents.map((c) => ({
          role: c.role,
          parts: c.parts,
        })),
        config,
      });

      if (!response || !response.text) {
        throw new Error("Empty response from Gemini API");
      }

      return response.text;
    } catch (error: any) {
      console.error("[Gemini] Error generating content:", error);

      if (error.message?.includes("API key")) {
        throw new Error(
          "Invalid Gemini API key. Please verify your GOOGLE_AI_API_KEY environment variable."
        );
      }

      if (error.message?.includes("quota")) {
        throw new Error(
          "Gemini API quota exceeded. Please check your usage limits."
        );
      }

      throw new Error(
        `Gemini API error: ${error.message || "Unknown error occurred"}`
      );
    }
  }

  getModel(): string {
    return this.modelName;
  }
}
