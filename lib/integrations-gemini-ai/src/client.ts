import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI;

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  console.warn("AI_INTEGRATIONS_GEMINI_BASE_URL or AI_INTEGRATIONS_GEMINI_API_KEY is missing. Mocking GoogleGenAI client.");
  aiInstance = {
    models: {
      generateContent: async () => ({
        candidates: [{
          content: { parts: [{ text: "Mock response" }] }
        }]
      })
    }
  } as any;
} else {
  aiInstance = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });
}

export const ai = aiInstance;
