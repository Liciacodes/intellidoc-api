import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { geminiService } from "../services/geminiService";

// FIXED: Use require instead of import for pdf-parse
const {pdf} = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

const router = Router();
const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const upload = multer({ storage: multer.memoryStorage() });

const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdf(buffer);
    let text = data.text || '';
    
    // Basic text cleaning (same as before)
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n\n+/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`PDF extraction (pdf-parse): ${text.length} characters extracted`);
    
    // Check for substantial content (same logic as before)
    const hasSubstantialContent = text.length > 200 && 
                                 text.includes(' ') && 
                                 !text.startsWith('#') &&
                                 !text.includes('Document content will be displayed') &&
                                 !text.includes('No text content available');
    
    if (hasSubstantialContent) {
      console.log('✅ PDF text extraction successful - real content found');
      console.log(`Content preview: ${text.substring(0, 200)}...`);
      return text;
    }
    
    // If pdf-parse failed or extracted poor quality, fall back to OCR
    console.warn('⚠️ PDF extraction may have failed - attempting OCR for scanned PDF');
    
    // Import pdf2pic dynamically (to avoid issues if not installed)
    const pdf2pic = require('pdf2pic');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Create a temp directory for images
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));
    
    // Convert PDF to images (limit to first 10 pages for performance)
    const convert = pdf2pic.fromBuffer(buffer, {
      density: 200,           // Higher DPI for better OCR (adjust for speed vs. accuracy)
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 2000,            // Resize for consistency
      height: 2000
    });
    
    const results = await convert.bulk(-1); // Convert all pages (-1), but we'll limit processing
    const maxPages = Math.min(results.length, 10); // Process up to 10 pages
    let ocrText = '';
    
    for (let i = 0; i < maxPages; i++) {
      const pagePath = results[i].path;
      if (fs.existsSync(pagePath)) {
        console.log(`🔍 Running OCR on page ${i + 1}/${maxPages}`);
        
        // Optional: Preprocess image with Sharp for better OCR
        const sharp = require('sharp');
        const processedImage = await sharp(pagePath)
          .greyscale()  // Convert to grayscale
          .normalise()  // Improve contrast
          .toBuffer();
        
        const { data: { text: pageText } } = await Tesseract.recognize(processedImage, 'eng', {
          logger: (m: any) => console.log(m)  // Optional: Log OCR progress
        });
        
        ocrText += pageText + '\n\n';  // Add page break
      }
    }
    
    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Clean and validate OCR text
    ocrText = ocrText
      .replace(/\r\n/g, '\n')
      .replace(/\n\n+/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`OCR extraction completed: ${ocrText.length} characters extracted`);
    
    if (ocrText.length > 100) {
      console.log('✅ OCR successful - scanned PDF processed');
      console.log(`Content preview: ${ocrText.substring(0, 200)}...`);
      return ocrText;
    } else {
      console.warn('❌ OCR failed - no usable text from scanned PDF');
      return '';
    }
    
  } catch (error: any) {
    console.error('PDF text extraction (including OCR) failed:', error.message);
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

      console.log("📤 Upload request received:", {
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
          textContent = await extractTextFromPDF(file.buffer);
          extractionMethod = 'pdf';
          extractionSuccess = textContent.length > 100;
          
          if (textContent.length === 0) {
            extractionWarning = 'PDF_IS_SCANNED: No text could be extracted. This appears to be a scanned PDF.';
          } else if (!extractionSuccess) {
            extractionWarning = 'PDF_LOW_QUALITY: Very little text extracted. PDF may be scanned or have complex formatting.';
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
          console.warn(`Unsupported file type for text extraction: ${file.mimetype}`);
          extractionMethod = 'unsupported';
        }
        
        console.log(`📝 Text extraction (${extractionMethod}): ${textContent.length} characters, success: ${extractionSuccess}`);
        
        if (textContent.length > 0 && extractionSuccess) {
          console.log(`📄 Real content preview: ${textContent.substring(0, 200)}...`);
        } else if (textContent.length > 0 && !extractionSuccess) {
          console.warn(`⚠️ Extracted text but quality is poor: ${textContent.substring(0, 100)}...`);
        } else {
          console.warn('❌ No usable text content extracted from the file');
        }
      } catch (extractionError) {
        console.error('❌ Text extraction failed:', extractionError);
      }

      const filePath = `documents/${Date.now()}_${file.originalname}`;

      console.log("☁️ Uploading to Supabase storage...");

      // Upload file buffer to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error("❌ Supabase upload error:", uploadError);
        return res
          .status(500)
          .json({ error: `Storage upload failed: ${uploadError.message}` });
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      console.log("✅ File uploaded to Supabase, URL:", publicUrlData.publicUrl);

      // Create document data
      const documentData: any = {
        title: title || file.originalname,
        fileUrl: publicUrlData.publicUrl,
        fileType: file.mimetype,
        size: file.size,
        textContent: extractionSuccess ? textContent : '',
      };

      // Save document record to database
      const savedDoc = await prisma.document.create({
        data: documentData,
      });

      console.log("💾 Document saved to database successfully:", {
        id: savedDoc.id,
        title: savedDoc.title,
        textContentLength: savedDoc.textContent?.length || 0,
        hasRealContent: extractionSuccess,
        extractionWarning: extractionWarning
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
      console.error("❌ Upload error:", error);
      res.status(500).json({
        error: "Error uploading document",
        details: error.message,
      });
    }
  }
);

// Test PDF extraction route
router.post("/test-pdf-extraction", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "Please upload a file" });
    }

    console.log("🧪 Testing file extraction:", file.originalname);
    console.log("📄 File type:", file.mimetype);
    console.log("📊 File size:", file.size, "bytes");
    
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
    
    const hasSubstantialText = text.length > 100;
    let analysis = '';
    
    if (text.length === 0) {
      analysis = "❌ NO TEXT EXTRACTED - This may be a SCANNED PDF (image-based) or there was an extraction error.";
    } else if (text.length < 100) {
      analysis = "⚠️ VERY LITTLE TEXT - The PDF may be scanned or have complex formatting.";
    } else {
      analysis = "✅ TEXT EXTRACTION SUCCESSFUL - The PDF contains readable text content.";
    }
    
    res.json({
      success: true,
      method: method,
      textLength: text.length,
      textPreview: text.substring(0, 1000),
      hasSubstantialText: hasSubstantialText,
      fullText: text.length > 0 ? text : 'NO TEXT EXTRACTED',
      analysis: analysis,
      isScannedPdf: text.length === 0,
      suggestions: text.length === 0 ? [
        "Convert this PDF to Word format using Adobe Acrobat or online converters",
        "Use a PDF with selectable text (try highlighting text with your mouse)",
        "This document may require OCR software to extract text from images"
      ] : []
    });
    
  } catch (error: any) {
    console.error("File extraction test error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

    console.log(`🤖 Generating summary for document ${id}, text length: ${text.length}`);
    
    if (text.length > 0) {
      console.log(`📄 Text preview: ${text.substring(0, 200)}`);
    }

    // Check if this document can be summarized
    if (!text || text.trim().length < 50) {
      let errorMessage = "This document cannot be summarized because no text content was extracted.";
      let solutions = [];
      
      if (document.fileType === 'application/pdf') {
        errorMessage += " This PDF appears to be scanned (image-based) and cannot be read by our system.";
        solutions = [
          "📝 Convert the PDF to a Word document (.docx) using:",
          "   - Adobe Acrobat 'Export to Word'",
          "   - Online converters like SmallPDF or ILovePDF", 
          "   - Microsoft Word's 'Open PDF' feature",
          "",
          "📄 Upload the Word document instead of the PDF",
          "",
          "🔍 Check if your PDF has selectable text:",
          "   - Open the PDF in Adobe Reader",
          "   - Try to select text with your mouse",
          "   - If you can't select text, it's a scanned PDF"
        ];
      } else {
        solutions = [
          "Ensure the document contains actual text (not images)",
          "Try uploading in a different format (Word, Text, etc.)",
          "Copy and paste the text content into a new document"
        ];
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        details: {
          documentTitle: document.title,
          fileType: document.fileType,
          textLength: text.length,
          issue: "scanned_pdf_or_extraction_error",
          solutions: solutions
        }
      });
    }

    const summary = await geminiService.summarizeText(text);

    res.json({
      summary,
      documentId: id,
      textLength: text.length,
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

// Manual content submission route
router.post("/:id/manual-content", async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ 
        error: "Please provide meaningful text content (at least 10 characters)" 
      });
    }

    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update the document with manually provided content
    await prisma.document.update({
      where: { id: id as string },
      data: { textContent: content.trim() }
    });

    console.log(`📝 Manual content submitted for document ${id}, length: ${content.length}`);

    res.json({
      success: true,
      message: "Content submitted successfully! You can now generate a summary.",
      textLength: content.length,
      canSummarize: true,
      documentId: id
    });

  } catch (error: any) {
    console.error("Content submission error:", error);
    res.status(500).json({ 
      error: "Error submitting content",
      details: error.message 
    });
  }
});

// Keep all your other routes the same...
router.get("/", async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
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

router.get("/:id/content", async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: id as string },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      text: document.textContent || `# ${document.title}\n\nNo text content available.\n\nThis document appears to be a scanned PDF and cannot be read automatically. Please convert it to a Word document or provide the text content manually.`,
      title: document.title,
      fileType: document.fileType,
      hasContent: !!document.textContent && document.textContent.length > 0
    });
  } catch (error: any) {
    console.error("Get document content error:", error);
    res.status(500).json({ error: "Error fetching document content" });
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