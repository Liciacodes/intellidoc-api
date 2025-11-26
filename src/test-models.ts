import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function testModels() {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_GEMINI_API_KEY in environment variables");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // List of common Gemini models to test
    const modelsToTest = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-pro",
      "gemini-pro-vision"
    ];

    console.log("\n=== Testing Available Gemini Models ===\n");

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✓ ${modelName} - AVAILABLE`);
      } catch (error: any) {
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          console.log(`✗ ${modelName} - NOT AVAILABLE`);
        } else {
          console.log(`? ${modelName} - ERROR: ${error.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error testing models:", error.message);
  }
}

testModels();