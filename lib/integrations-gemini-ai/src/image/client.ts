import { GoogleGenAI, Modality } from "@google/genai";

let aiInstance: GoogleGenAI;

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  console.warn("AI_INTEGRATIONS_GEMINI_BASE_URL or AI_INTEGRATIONS_GEMINI_API_KEY is missing. Mocking GoogleGenAI image client.");
  aiInstance = {
    models: {
      generateContent: async () => ({
        candidates: [{
          content: { parts: [{ inlineData: { data: "mock_b64_json", mimeType: "image/png" } }] }
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

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
