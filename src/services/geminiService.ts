import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Updated model name here
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async summarizeText(text: string): Promise<string> {
    try {
      const truncatedText = text.slice(0, 30000); // ~6000 words

      const prompt = `Please provide a concise summary of the following document. Focus on the main points, key findings, and important details. Keep the summary clear and well-structured:

${truncatedText}

Summary:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      return summary;
    } catch (error: any) {
      console.error('Gemini summarization error:', error);

      if (error.message?.includes('API key not valid')) {
        throw new Error('Invalid Google Gemini API key. Please check your environment variables.');
      } else if (error.message?.includes('quota')) {
        throw new Error('API quota exceeded. Please check your Google AI Studio usage.');
      } else {
        throw new Error(`Failed to generate summary: ${error.message}`);
      }
    }
  }

  async extractKeyPoints(text: string): Promise<string[]> {
    try {
      const truncatedText = text.slice(0, 30000);

      const prompt = `Extract the 5-7 most important key points from the following document. Return them as a bulleted list:

${truncatedText}

Key Points:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const keyPointsText = response.text();

      return keyPointsText
        .split('\n')
        .filter((line: string) =>
          line.trim().startsWith('-') ||
          line.trim().startsWith('•') ||
          line.trim().match(/^\d+\./)
        )
        .map((point: string) => point.replace(/^[-•\d\.\s]+/, '').trim())
        .filter((point: string) => point.length > 0);
    } catch (error: any) {
      console.error('Gemini key points extraction error:', error);
      throw new Error('Failed to extract key points');
    }
  }
}

export const geminiService = new GeminiService();
