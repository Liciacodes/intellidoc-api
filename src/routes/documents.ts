import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";


const router = Router();
const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const upload = multer({ storage: multer.memoryStorage() });

interface UploadDocumentRequest {
  title: string;
}

router.get("/", async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    res.json(documents);
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
    res.json(document);
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: "Error fetching document" });
  }
});

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

      // Create document data without userId
      const documentData: any = {
        title: title || file.originalname,
        fileUrl: publicUrlData.publicUrl,
        fileType: file.mimetype,
        textContent: "",
        size: file.size,
      };

      // Save document record
      const savedDoc = await prisma.document.create({
        data: documentData,
      });

      console.log("Document saved to database successfully:", savedDoc.id);

      res.json({
        id: savedDoc.id,
        title: savedDoc.title,
        fileUrl: savedDoc.fileUrl,
        fileType: savedDoc.fileType,
        uploadedAt: savedDoc.uploadedAt,
        size: savedDoc.size,
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