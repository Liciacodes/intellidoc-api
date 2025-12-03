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

 // Add this method right after the summarizeText method
async askQuestion(documentText: string, question: string): Promise<string> {
  try {
    console.log(`Q&A: Asking "${question}" on ${documentText.length} chars document`);
    
    // Truncate if too long (Gemini token limit)
    const truncatedText = documentText.length > 10000 
      ? documentText.substring(0, 10000) + "..."
      : documentText;
    
    const prompt = `Based EXCLUSIVELY on the following document, answer this question: "${question}"
    
DOCUMENT CONTENT:
${truncatedText}

IMPORTANT RULES:
1. Answer ONLY using information from the document above
2. If the answer isn't in the document, say: "I couldn't find that information in the document."
3. Keep answers concise and to the point (2-4 sentences max)
4. Do not make up or assume any information

ANSWER:`;
    
    const result = await this.geminiModel.generateContent([
      {
        text: prompt
      }
    ]);

    const answer = result.response.text();
    console.log(`Q&A Answer generated: ${answer.length} chars`);
    return answer;
    
  } catch (error: any) {
    console.error('Gemini Q&A error:', error);
    throw new Error(`Failed to answer question: ${error.message}`);
  }
}
}

// Export a singleton instance
export const geminiService = new GeminiService();