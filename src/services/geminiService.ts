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
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
      }
    });
  }

  async summarizeText(text: string): Promise<string> {
    try {
      // Check if text is meaningful
      if (!text || text.trim().length < 50) {
        throw new Error('Text too short for summarization');
      }

      const truncatedText = text.slice(0, 30000);

      const prompt = `Please provide a concise summary (3-5 paragraphs) of the following document. Focus on the main points, key findings, and important details. Keep the summary clear and well-structured:

${truncatedText}

Summary:`;

      console.log('Sending request to Gemini API...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      if (!summary || summary.trim().length === 0) {
        throw new Error('Empty response from AI service');
      }

      console.log('Summary generated successfully');
      return summary.trim();
    } catch (error: any) {
      console.error('Gemini summarization error:', error);
      
      // More specific error handling
      if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
        throw new Error('Invalid Google Gemini API key. Please check your environment variables.');
      } else if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('API quota exceeded. Please check your Google AI Studio usage.');
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        throw new Error('API permission denied. Please check your API key permissions.');
      } else {
        throw new Error(`Failed to generate summary: ${error.message}`);
      }
    }
  }

  async extractKeyPoints(text: string): Promise<string[]> {
    try {
      const truncatedText = text.slice(0, 30000);

      const prompt = `Extract the 5-7 most important key points from the following document. Return them as a bulleted list with each point on a new line starting with "-":

${truncatedText}

Key Points:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const keyPointsText = response.text();

      // Improved parsing for bullet points
      return keyPointsText
        .split('\n')
        .filter((line: string) => 
          line.trim().startsWith('-') ||
          line.trim().startsWith('•') ||
          line.trim().startsWith('*') ||
          line.trim().match(/^\d+\./)
        )
        .map((point: string) => 
          point.replace(/^[-•*\d\.\s]+/, '').trim()
        )
        .filter((point: string) => point.length > 0)
        .slice(0, 7); // Limit to 7 points
    } catch (error: any) {
      console.error('Gemini key points extraction error:', error);
      throw new Error(`Failed to extract key points: ${error.message}`);
    }
  }
}

export const geminiService = new GeminiService();