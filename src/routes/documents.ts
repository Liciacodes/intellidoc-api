import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { geminiService } from "../services/geminiService";
import { requireAuth } from "../middleware/auth";

const mammoth = require('mammoth');

const router = Router();
const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const upload = multer({ storage: multer.memoryStorage() });


const pdfParse = require('pdf-parse');

// Replace your entire extractTextFromPDF function with:
const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    console.log('Extracting PDF text with pdf-parse...');
    
    const data = await pdfParse(buffer);
    let text = data.text || '';
    
    console.log(`Extracted ${text.length} characters`);
    
    if (text.length === 0) {
      console.log('No text extracted - PDF is likely scanned');
      return '';
    }
    
    // Clean the text properly
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Cleaned to ${text.length} characters`);
    console.log('Sample:', text.substring(0, 200));
    
    return text;
    
  } catch (error: any) {
    console.error('PDF extraction error:', error.message);
    return '';
  }
};



const extractTextFromDOCX = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return '';
  }
};

const extractTextFromTextFile = (buffer: Buffer): string => {
  return buffer.toString('utf8').trim();
};


const ensureDocumentSize = (doc: any) => ({
  ...doc,
  size: doc.size || 0
});


router.post(
  "/uploads", requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const { title } = req.body;
      const file = req.file;
      const userId = (req as any).userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("Upload request received:", {
        title: title,
        file: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        } : "No file",
      });

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!title) {
        return res.status(400).json({ error: "Missing title" });
      }

      // Extract text content based on file type
      let textContent = '';
      let extractionMethod = 'none';
      let extractionSuccess = false;
      let extractionWarning = '';
      
      try {
        if (file.mimetype === 'application/pdf') {
          console.log('🔍 Extracting text from PDF...');
          textContent = await extractTextFromPDF(file.buffer);
          extractionMethod = 'pdf';
          extractionSuccess = textContent.length > 50; // Lower threshold
          
          console.log(`PDF extraction result: ${textContent.length} chars, success: ${extractionSuccess}`);
          
          if (textContent.length === 0) {
            extractionWarning = 'PDF_IS_SCANNED: No text could be extracted.';
          } else if (!extractionSuccess) {
            extractionWarning = 'PDF_LOW_QUALITY: Very little text extracted.';
          }
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          textContent = await extractTextFromDOCX(file.buffer);
          extractionMethod = 'docx';
          extractionSuccess = textContent.length > 0;
        } else if (file.mimetype.includes('text/') || file.mimetype === 'application/json') {
          textContent = extractTextFromTextFile(file.buffer);
          extractionMethod = 'text';
          extractionSuccess = textContent.length > 0;
        } else {
          console.warn(`Unsupported file type: ${file.mimetype}`);
          extractionMethod = 'unsupported';
        }
        
        console.log(`Extraction (${extractionMethod}): ${textContent.length} chars, success: ${extractionSuccess}`);
        
        if (textContent.length > 0) {
          console.log(`Content preview: ${textContent.substring(0, 200)}...`);
        }
      } catch (extractionError) {
        console.error('Text extraction failed:', extractionError);
      }

      const filePath = `documents/${Date.now()}_${file.originalname}`;

      console.log("Uploading to Supabase storage...");

      // Upload file buffer to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return res
          .status(500)
          .json({ error: `Storage upload failed: ${uploadError.message}` });
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      console.log("File uploaded to Supabase, URL:", publicUrlData.publicUrl);

      // Create document data 
      const documentData: any = {
        title: title || file.originalname,
        fileUrl: publicUrlData.publicUrl,
        fileType: file.mimetype,
        size: file.size,
        textContent: textContent, 
       userId: userId
      };

      console.log("💾 Saving to database with textContent length:", textContent.length);

      // Save document record to database
      const savedDoc = await prisma.document.create({
        data: documentData,
      });

      console.log("Document saved to database:", {
        id: savedDoc.id,
        title: savedDoc.title,
        textContentLength: savedDoc.textContent?.length || 0,
        hasRealContent: extractionSuccess,
      });

      res.json({
        id: savedDoc.id,
        title: savedDoc.title,
        fileUrl: savedDoc.fileUrl,
        fileType: savedDoc.fileType,
        uploadedAt: savedDoc.uploadedAt,
        size: savedDoc.size || 0,
        hasTextContent: extractionSuccess,
        textContentLength: savedDoc.textContent?.length || 0,
        extractionSuccess: extractionSuccess,
        warning: extractionWarning,
        canSummarize: extractionSuccess
      });
    } catch (error: any) {
      console.error(" Upload error:", error);
      res.status(500).json({
        error: "Error uploading document",
        details: error.message,
      });
    }
  }
);


router.post("/test-pdfreader", upload.single("file"), async (req, res) => {
  const file = req.file;
  
  if (!file || file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: "Upload a PDF" });
  }
  
  console.log("Testing pdfreader on:", file.originalname);
  
  const text = await extractTextFromPDF(file.buffer);
  
  res.json({
    fileName: file.originalname,
    textLength: text.length,
    hasText: text.length > 0,
    textPreview: text.substring(0, 500),
    isScanned: text.length === 0,
    message: text.length > 0 
      ? "PDF has readable text" 
      : " PDF is SCANNED (image-based)"
  });
});
router.post("/test-pdf-extraction", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "Please upload a file" });
    }

    console.log("Testing file extraction:", file.originalname);
    
    let text = '';
    let method = '';
    
    if (file.mimetype === 'application/pdf') {
      text = await extractTextFromPDF(file.buffer);
      method = 'pdf';
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await extractTextFromDOCX(file.buffer);
      method = 'docx';
    } else if (file.mimetype.includes('text/')) {
      text = extractTextFromTextFile(file.buffer);
      method = 'text';
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    
    res.json({
      success: true,
      method: method,
      textLength: text.length,
      textPreview: text.substring(0, 1000),
      fullText: text,
      hasContent: text.length > 0
    });
    
  } catch (error: any) {
    console.error("File extraction test error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});




router.post("/:id/summarize", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📊 Summarization request for document: ${id}`);

    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      console.error(`❌ Document ${id} not found`);
      return res.status(404).json({ error: "Document not found" });
    }

    console.log(`✅ Document found:`, {
      title: document.title,
      fileType: document.fileType,
      textContentLength: document.textContent?.length || 0
    });

    const text = document.textContent || "";

    if (!text || text.trim().length < 50) {
      console.error(`❌ Insufficient text: ${text.length} characters`);
      
      return res.status(400).json({ 
        error: "Cannot summarize: No text content available",
        details: {
          documentTitle: document.title,
          fileType: document.fileType,
          textLength: text.length,
          message: "The document has no extractable text. This could be a scanned PDF or text extraction failed."
        }
      });
    }

    console.log(`✅ Text ready for summarization: ${text.length} chars`);
    console.log(`📝 Preview: ${text.substring(0, 200)}...`);

    // Try to generate summary with detailed error catching
    let summary;
    try {
      summary = await geminiService.summarizeText(text);
      console.log(`✅ Summary generated successfully: ${summary.length} chars`);
    } catch (geminiError: any) {
      console.error('❌ GEMINI API ERROR:', {
        message: geminiError.message,
        stack: geminiError.stack,
        name: geminiError.name
      });
      
      // Check for specific Gemini errors
      if (geminiError.message?.includes('API key')) {
        return res.status(500).json({
          error: "Gemini API key is missing or invalid",
          details: "Check your GOOGLE_GEMINI_API_KEY environment variable",
          geminiError: geminiError.message
        });
      }
      
      if (geminiError.message?.includes('quota') || geminiError.message?.includes('rate limit')) {
        return res.status(429).json({
          error: "Gemini API rate limit exceeded",
          details: "Please wait a moment and try again",
          geminiError: geminiError.message
        });
      }
      
      // Generic Gemini error
      return res.status(500).json({
        error: "Gemini API error",
        details: geminiError.message,
        help: "Check your API key and internet connection"
      });
    }

    res.json({
      summary,
      documentId: id,
      textLength: text.length,
      success: true
    });

  } catch (error: any) {
    console.error("❌ SUMMARIZATION ERROR:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: "Error generating summary",
      details: error.message,
      type: error.name || 'Unknown error'
    });
  }
});


router.post("/:id/ask", async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    console.log(`❓ Q&A request for document ${id}:`, { question });

    // Validation
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ 
        error: "Please ask a meaningful question (at least 3 characters)" 
      });
    }

    // Find document
    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      return res.status(404).json({ 
        error: "Document not found" 
      });
    }

    // Check text content
    const text = document.textContent || "";

    if (!text || text.length < 50) {
      return res.status(400).json({ 
        error: "This document doesn't have enough text to answer questions",
        textLength: text.length,
        solution: "Please upload a document with readable text content"
      });
    }

    console.log(`📄 Document has ${text.length} characters`);

    // Generate answer
    let answer;
    try {
      answer = await geminiService.askQuestion(text, question.trim());
      console.log(`✅ Answer generated: ${answer.length} characters`);
    } catch (aiError: any) {
      console.error('❌ AI ERROR:', aiError);
      
      // Return error with proper status code
      return res.status(500).json({
        error: "Failed to generate answer",
        details: aiError.message || "AI service error",
        help: "Please try again in a moment"
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      answer: answer,
      question: question.trim(),
      documentId: id,
      documentTitle: document.title,
      textLength: text.length
    });

  } catch (error: any) {
    console.error("❌ Q&A ERROR:", error);
    return res.status(500).json({ 
      error: "Failed to answer question",
      details: error.message || "Unknown error",
      type: error.name || 'Error'
    });
  }
});


router.post("/:id/key-points", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔑 Key points request for document: ${id}`);
    
    // Find document
    const document = await prisma.document.findUnique({ 
      where: { id: id as string } 
    });
    
    if (!document) {
      return res.status(404).json({ 
        error: "Document not found" 
      });
    }
    
    // Check text content
    const text = document.textContent || "";
    
    if (!text || text.length < 50) {
      return res.status(400).json({ 
        error: "Not enough text content",
        textLength: text.length,
        solution: "Please upload a document with readable text"
      });
    }
    
    console.log(`📄 Extracting key points from ${text.length} chars`);
    
    // Generate key points
    let keyPoints;
    try {
      keyPoints = await geminiService.extractKeyPoints(text);
      console.log(`✅ Extracted ${keyPoints.length} key points`);
    } catch (aiError: any) {
      console.error('❌ AI ERROR:', aiError);
      
      // Return error with proper status code
      return res.status(500).json({
        error: "Failed to extract key points",
        details: aiError.message || "AI service error",
        help: "Please try again in a moment"
      });
    }
    
    // Success response
    return res.status(200).json({
      success: true,
      keyPoints: keyPoints,
      documentId: id,
      documentTitle: document.title,
      count: keyPoints.length
    });
    
  } catch (error: any) {
    console.error('KEY POINTS ERROR:', error);
    return res.status(500).json({ 
      error: "Error extracting key points",
      details: error.message || "Unknown error",
      type: error.name || 'Error'
    });
  }
});
// Get all documents
router.get("/", requireAuth, async (req, res) => {
  try {

    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const documents = await prisma.document.findMany({
      where: {userId: userId},
      orderBy: { uploadedAt: "desc" },
    });

    const documentsWithSize = documents.map((doc: any) => ({
      ...doc,
      size: doc.size || 0
    }));

    res.json(documentsWithSize);
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      error: "Error fetching documents",
      details: error.message,
    });
  }
});

// Get single document
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const document = await prisma.document.findUnique({
      where: { id: id as string,
        userId: userId
       },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    res.json(ensureDocumentSize(document));
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: "Error fetching document" });
  }
});

// Get document content
router.get("/:id/content", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const document = await prisma.document.findUnique({
      where: { id: id as string, userId: userId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      text: document.textContent || `# ${document.title}\n\nNo text content available.`,
      title: document.title,
      fileType: document.fileType,
      hasContent: !!document.textContent && document.textContent.length > 0
    });
  } catch (error: any) {
    console.error("Get document content error:", error);
    res.status(500).json({ error: "Error fetching document content" });
  }
});

// Delete document
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const document = await prisma.document.findUnique({
      where: { id: id as string, userId: userId },
    });
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const urlParts = document.fileUrl.split("/documents/");
    const storagePath = `documents/${urlParts[1]}`;

    const { error: deleteError } = await supabase.storage
      .from("documents")
      .remove([storagePath]);

    if (deleteError) {
      console.error("Supabase deletion error:", deleteError);
      return res
        .status(500)
        .json({ error: "Failed to delete file from storage" });
    }

    await prisma.document.delete({
      where: { id: id as string },
    });

    res.json({
      message: "Document deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete error:", error);
    res.status(500).json({
      error: "Error deleting document",
      details: error.message,
    });
  }
});

export default router;