import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  private geminiModel;

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_GEMINI_API_KEY in environment variables");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    this.geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });
  }

  async summarizeText(text: string) {
   const cleanedText = text.trim();
    
    if (!cleanedText) {
      throw new Error("No text content to summarize");
    }

    const result = await this.geminiModel.generateContent([
      {
        text: `Please provide a clear and concise summary of the following text. Focus on the main points, key information, and important details:

${cleanedText}

Summary:`
      }
    ]);

    return result.response.text();
  }
}

// Export a singleton instance
export const geminiService = new GeminiService();