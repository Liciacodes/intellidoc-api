import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { geminiService } from "../services/geminiService";


const pdfParse: any = require('pdf-parse');

const router = Router();
const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const upload = multer({ storage: multer.memoryStorage() });

// Text extraction functions
const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return '';
  }
};

const extractTextFromTextFile = (buffer: Buffer): string => {
  return buffer.toString('utf8');
};

// Helper function to ensure size is never null
const ensureDocumentSize = (doc: any) => ({
  ...doc,
  size: doc.size || 0
});

// Upload document route
router.post(
  "/uploads",
  upload.single("file"),
  async (req, res) => {
    try {
      const { title } = req.body;
      const file = req.file;

      console.log("Upload request received:", {
        title: title,
        file: file
          ? {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            }
          : "No file",
      });

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!title) {
        return res.status(400).json({ error: "Missing title" });
      }

      // Extract text content based on file type
      let textContent = '';
      try {
        if (file.mimetype === 'application/pdf') {
          textContent = await extractTextFromPDF(file.buffer);
        } else if (file.mimetype.includes('text/') || 
                   file.mimetype === 'application/json' || 
                   file.mimetype.includes('document')) {
          textContent = extractTextFromTextFile(file.buffer);
        }
        
        console.log(`Text extraction: ${textContent.length} characters extracted`);
        
        if (textContent.length === 0) {
          console.warn('No text content could be extracted from the file');
        }
      } catch (extractionError) {
        console.error('Text extraction failed:', extractionError);
        // Continue without text content
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

      // Create document data with extracted text content
      const documentData: any = {
        title: title || file.originalname,
        fileUrl: publicUrlData.publicUrl,
        fileType: file.mimetype,
        textContent: textContent,
        size: file.size,
      };

      // Save document record
      const savedDoc = await prisma.document.create({
        data: documentData,
      });

      console.log("Document saved to database successfully:", {
        id: savedDoc.id,
        title: savedDoc.title,
        textContentLength: savedDoc.textContent?.length || 0
      });

      res.json({
        id: savedDoc.id,
        title: savedDoc.title,
        fileUrl: savedDoc.fileUrl,
        fileType: savedDoc.fileType,
        uploadedAt: savedDoc.uploadedAt,
        size: savedDoc.size || 0,
        hasTextContent: !!savedDoc.textContent && savedDoc.textContent.length > 0
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: "Error uploading document",
        details: error.message,
      });
    }
  }
);

// Add the test route to verify Gemini API
router.post("/test-gemini", async (req, res) => {
  try {
    const testText = "This is a test document content. Artificial intelligence is transforming how we work and live. Machine learning algorithms can now understand and process natural language with remarkable accuracy. This technology has applications in healthcare, education, business, and many other fields.";
    
    const summary = await geminiService.summarizeText(testText);
    
    res.json({
      success: true,
      summary: summary,
      message: "Gemini API is working correctly"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Gemini API test failed"
    });
  }
});

// Keep your other routes (GET, DELETE, etc.) the same as before
router.get("/", async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    const documentsWithSize = documents.map(doc => ({
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

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: id as string },
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
router.get("/:id/content", async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Return text content or placeholder
    res.json({
      text: document.textContent || `# ${document.title}\n\nDocument content will be displayed here.\n\nThis document was uploaded on ${new Date(document.uploadedAt).toLocaleDateString()} and is ${document.fileType} type.`,
      title: document.title,
      fileType: document.fileType,
      hasContent: !!document.textContent && document.textContent.length > 0
    });
  } catch (error: any) {
    console.error("Get document content error:", error);
    res.status(500).json({ error: "Error fetching document content" });
  }
});

// Generate AI summary
router.post("/:id/summarize", async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Use provided content or fall back to stored text content
    const text = content || document.textContent || "";

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ 
        error: "Document doesn't have enough text content for summarization. Please upload a document with readable text." 
      });
    }

    console.log(`Generating summary for document ${id}, text length: ${text.length}`);

    const summary = await geminiService.summarizeText(text);

    res.json({
      summary,
      documentId: id,
      success: true
    });

  } catch (error: any) {
    console.error("Summarization error:", error);
    res.status(500).json({ 
      error: "Error generating summary",
      details: error.message 
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const urlParts = document.fileUrl.split("/documents/");
    const storagePath = `documents/${urlParts}`;

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