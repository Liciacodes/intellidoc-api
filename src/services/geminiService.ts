import Groq from "groq-sdk";

export class GeminiService {
  private groq: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY in environment variables");
    }

    this.groq = new Groq({ apiKey });
  }

  async summarizeText(text: string): Promise<string> {
    const cleanedText = text.trim();

    if (!cleanedText) {
      throw new Error("No text content to summarize");
    }

    const response = await this.groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Please provide a clear and concise summary of the following text. Focus on the main points, key information, and important details:

${cleanedText}

Summary:`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1024,
    });

    // TypeScript-safe check with optional chaining
    if (!response.choices || response.choices.length === 0) {
      throw new Error("No response from AI");
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return content;
  }

  async askQuestion(documentText: string, question: string): Promise<string> {
    try {
      console.log(`Q&A: Asking "${question}" on ${documentText.length} chars document`);

      const truncatedText = documentText.length > 10000 
        ? documentText.substring(0, 10000) + "..."
        : documentText;

      const response = await this.groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Based EXCLUSIVELY on the following document, answer this question: "${question}"

DOCUMENT CONTENT:
${truncatedText}

IMPORTANT RULES:
1. Answer ONLY using information from the document above
2. If the answer isn't in the document, say: "I couldn't find that information in the document."
3. Keep answers concise and to the point (2-4 sentences max)
4. Do not make up or assume any information

ANSWER:`
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 500,
      });

      // TypeScript-safe check
      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from AI");
      }

      const content = response.choices[0]?.message?.content;
      const answer = content || "I couldn't generate an answer.";
      
      console.log(`✅ Q&A Answer generated: ${answer.length} chars`);
      return answer;
      
    } catch (error: any) {
      console.error("❌ Groq Q&A error:", error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }

  async extractKeyPoints(text: string): Promise<string[]> {
    try {
      console.log(`Extracting key points from ${text.length} chars`);
      
      const truncatedText = text.length > 8000 
        ? text.substring(0, 8000) + "..."
        : text;
      
      const response = await this.groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Extract 5-7 most important key points from the following text.

TEXT:
${truncatedText}

FORMAT REQUIREMENTS:
1. Return ONLY bullet points, one per line
2. Each bullet point must start with "• " (bullet symbol)
3. Each point should be a clear, concise statement
4. Focus on the most important information
5. Do not include any explanations, just the bullet points

KEY POINTS:`
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 500,
      });

      // TypeScript-safe check
      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from AI");
      }

      const content = response.choices[0]?.message?.content || "";
      console.log(`Key points extracted: ${content.length} chars`);
      
      // Parse bullet points from response
      const keyPoints = content
        .split('\n')
        .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
        .map(line => line.trim())
        .filter(line => line.length > 3);
      
      // If parsing fails, return the raw response split by new lines
      if (keyPoints.length === 0) {
        return content
          .split('\n')
          .filter(line => line.trim().length > 10)
          .map(line => line.trim());
      }
      
      return keyPoints;
      
    } catch (error: any) {
      console.error('Key points extraction error:', error);
      throw new Error(`Failed to extract key points: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const geminiService = new GeminiService();








//import { GoogleGenerativeAI } from "@google/generative-ai";

// export class GeminiService {
//   private geminiModel;

//   constructor() {
//     const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
//     if (!apiKey) {
//       throw new Error("Missing GOOGLE_GEMINI_API_KEY in environment variables");
//     }

//     const genAI = new GoogleGenerativeAI(apiKey);

//     this.geminiModel = genAI.getGenerativeModel({
//       model: "gemini-2.0-flash",
//       generationConfig: {
//         temperature: 0.3,
//         maxOutputTokens: 1024,
//       },
//     });
//   }

//   async summarizeText(text: string) {
//     const cleanedText = text.trim();

//     if (!cleanedText) {
//       throw new Error("No text content to summarize");
//     }

//     const result = await this.geminiModel.generateContent([
//       {
//         text: `Please provide a clear and concise summary of the following text. Focus on the main points, key information, and important details:

// ${cleanedText}

// Summary:`,
//       },
//     ]);

//     return result.response.text();
//   }

//   async askQuestion(documentText: string, question: string): Promise<string> {
//     try {
//       console.log(
//         `Q&A: Asking "${question}" on ${documentText.length} chars document`
//       );

//       const truncatedText =
//         documentText.length > 10000
//           ? documentText.substring(0, 10000) + "..."
//           : documentText;

//       const prompt = `Based EXCLUSIVELY on the following document, answer this question: "${question}"
    
// DOCUMENT CONTENT:
// ${truncatedText}

// IMPORTANT RULES:
// 1. Answer ONLY using information from the document above
// 2. If the answer isn't in the document, say: "I couldn't find that information in the document."
// 3. Keep answers concise and to the point (2-4 sentences max)
// 4. Do not make up or assume any information

// ANSWER:`;

//       const result = await this.geminiModel.generateContent([
//         {
//           text: prompt,
//         },
//       ]);

//       const answer = result.response.text();
//       console.log(`✅ Q&A Answer generated: ${answer.length} chars`);
//       return answer;
//     } catch (error: any) {
//       console.error("❌ Gemini Q&A error:", error);
//       throw new Error(`Failed to answer question: ${error.message}`);
//     }
//   }

//   // NEW: Key Points extraction method
//   async extractKeyPoints(text: string): Promise<string[]> {
//     try {
//       console.log(`Extracting key points from ${text.length} chars`);
      
//       const truncatedText = text.length > 8000 
//         ? text.substring(0, 8000) + "..."
//         : text;
      
//       const prompt = `Extract 5-7 most important key points from the following text.
      
// TEXT:
// ${truncatedText}

// FORMAT REQUIREMENTS:
// 1. Return ONLY bullet points, one per line
// 2. Each bullet point must start with "• " (bullet symbol)
// 3. Each point should be a clear, concise statement
// 4. Focus on the most important information
// 5. Do not include any explanations, just the bullet points

// KEY POINTS:`;
      
//       const result = await this.geminiModel.generateContent([
//         {
//           text: prompt
//         }
//       ]);
      
//       const response = result.response.text();
//       console.log(`Key points extracted: ${response.length} chars`);
      
//       // Parse bullet points from response
//       const keyPoints = response
//         .split('\n')
//         .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
//         .map(line => line.trim())
//         .filter(line => line.length > 3); // Remove empty/short lines
      
//       // If parsing fails, return the raw response split by new lines
//       if (keyPoints.length === 0) {
//         return response
//           .split('\n')
//           .filter(line => line.trim().length > 10)
//           .map(line => line.trim());
//       }
      
//       return keyPoints;
      
//     } catch (error: any) {
//       console.error('Key points extraction error:', error);
//       throw new Error(`Failed to extract key points: ${error.message}`);
//     }
//   }
// }

// // Export a singleton instance
// export const geminiService = new GeminiService();


// import { GoogleGenerativeAI } from "@google/generative-ai";

// export class GeminiService {
//   private geminiModel;

//   constructor() {
//     const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
//     if (!apiKey) {
//       throw new Error("Missing GOOGLE_GEMINI_API_KEY in environment variables");
//     }

//     const genAI = new GoogleGenerativeAI(apiKey);

//     this.geminiModel = genAI.getGenerativeModel({
//       model: "gemini-2.0-flash",
//       generationConfig: {
//         temperature: 0.3,
//         maxOutputTokens: 1024,
//       },
//     });
//   }

//   async summarizeText(text: string): Promise<string> {
//     const cleanedText = text.trim();

//     if (!cleanedText) {
//       throw new Error("No text content to summarize");
//     }

//     const result = await this.geminiModel.generateContent([
//       {
//         text: `Please provide a clear and concise summary of the following text. Focus on the main points, key information, and important details:

// ${cleanedText}

// Summary:`,
//       },
//     ]);

//     return result.response.text();
//   }

//   async askQuestion(documentText: string, question: string): Promise<string> {
//     try {
//       console.log(
//         `Q&A: Asking "${question}" on ${documentText.length} chars document`
//       );

//       const truncatedText =
//         documentText.length > 10000
//           ? documentText.substring(0, 10000) + "..."
//           : documentText;

//       const prompt = `Based EXCLUSIVELY on the following document, answer this question: "${question}"
    
// DOCUMENT CONTENT:
// ${truncatedText}

// IMPORTANT RULES:
// 1. Answer ONLY using information from the document above
// 2. If the answer isn't in the document, say: "I couldn't find that information in the document."
// 3. Keep answers concise and to the point (2-4 sentences max)
// 4. Do not make up or assume any information

// ANSWER:`;

//       const result = await this.geminiModel.generateContent([
//         {
//           text: prompt,
//         },
//       ]);

//       const answer = result.response.text();
//       console.log(`✅ Q&A Answer generated: ${answer.length} chars`);
//       return answer;
//     } catch (error: any) {
//       console.error("❌ Gemini Q&A error:", error);
//       throw new Error(`Failed to answer question: ${error.message}`);
//     }
//   }

//   async extractKeyPoints(text: string): Promise<string[]> {
//     try {
//       console.log(`Extracting key points from ${text.length} chars`);
      
//       const truncatedText = text.length > 8000 
//         ? text.substring(0, 8000) + "..."
//         : text;
      
//       const prompt = `Extract 5-7 most important key points from the following text.
      
// TEXT:
// ${truncatedText}

// FORMAT REQUIREMENTS:
// 1. Return ONLY bullet points, one per line
// 2. Each bullet point must start with "• " (bullet symbol)
// 3. Each point should be a clear, concise statement
// 4. Focus on the most important information
// 5. Do not include any explanations, just the bullet points

// KEY POINTS:`;
      
//       const result = await this.geminiModel.generateContent([
//         {
//           text: prompt
//         }
//       ]);
      
//       const response = result.response.text();
//       console.log(`Key points extracted: ${response.length} chars`);
      
//       // Parse bullet points from response
//       const keyPoints = response
//         .split('\n')
//         .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
//         .map(line => line.trim())
//         .filter(line => line.length > 3); // Remove empty/short lines
      
//       // If parsing fails, return the raw response split by new lines
//       if (keyPoints.length === 0) {
//         return response
//           .split('\n')
//           .filter(line => line.trim().length > 10)
//           .map(line => line.trim());
//       }
      
//       return keyPoints;
      
//     } catch (error: any) {
//       console.error('Key points extraction error:', error);
//       throw new Error(`Failed to extract key points: ${error.message}`);
//     }
//   }
// }

// // Export a singleton instance - FIXED: Added proper export keyword
// export const geminiService = new GeminiService();