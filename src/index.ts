










import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/api-health", (req, res) => {
  res.json({ status: "ok", message: "Intellidoc API is running" });
});

// Use routers
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});























// import dotenv from "dotenv";
// import crypto from 'crypto'
// import bcrypt from "bcryptjs";
// import nodemailer from 'nodemailer'
// import jwt from "jsonwebtoken";
// import express, { type Request, type Response } from "express";
// import cors from "cors";
// import { PrismaClient } from "@prisma/client";
// import { createClient } from "@supabase/supabase-js";
// import multer from "multer";

// dotenv.config();

// const app = express();
// const prisma = new PrismaClient();
// const supabase = createClient(
//   process.env.SUPABASE_URL as string,
//   process.env.SUPABASE_SERVICE_ROLE_KEY as string
// );
// const upload = multer({ storage: multer.memoryStorage() });

// app.use(
//   cors({
//     origin: ["http://localhost:5173", "http://localhost:5000"],
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const JWT_SECRET = process.env.JWT_SECRET;
// if (!JWT_SECRET) {
//   throw new Error("Missing JWT_SECRET environment variable");
// }

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.GMAIL_APP_USER,
//     pass: process.env.GMAIL_APP_PASS
//   }
// })

// app.get("/api-health", (req, res) => {
//   res.json({ status: "ok", message: "Intellidoc API is running" });
// });

// interface UploadDocumentRequest {
//   title: string;
// }

// app.post("/api/auth/register", async (req: Request, res: Response) => {
//   const { email, password } = req.body;
//   if (!email || !password)
//     return res.status(400).json({ error: "Email and Password required" });

//   const existingUser = await prisma.user.findUnique({ where: { email } });
//   if (existingUser)
//     return res.status(409).json({ error: "User already exists" });

//   const hashedPassword = await bcrypt.hash(password, 10);

//   const user = await prisma.user.create({
//     data: {
//       email,
//       password: hashedPassword,
//     },
//   });

//   return res
//     .status(201)
//     .json({ message: "User registered successfully", userId: user.id });
// });


// app.post("/api/auth/login", async (req: Request, res: Response) => {
//   const { email, password } = req.body;

//   if (!email || !password)
//     return res.status(400).json({ error: "Email and password not found" });
//   const user = await prisma.user.findUnique({ where: { email } });

//   if (!user)
//     return res.status(401).json({
//       error: "Invalid Credentials",
//     });

//   const validPassword = await bcrypt.compare(password, user.password);

//   if (!validPassword)
//     return res.status(401).json({
//       error: "Invalid Credentials",
//     });

//   const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
//   res.json({ token });
// });

// app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
//   try {
//     const { email } = req.body;

//     console.log('Forgot password request for:', email);

//     if (!email) {
//       return res.status(400).json({ error: 'Email is required' });
//     }

//     const user = await prisma.user.findUnique({ where: { email } });
    
//     // Always return success to prevent email enumeration
//     if (!user) {
      
//       return res.json({ 
//         message: 'If this email exists in our system, a password reset link has been sent.' 
//       });
//     }

//     // Generate reset token
//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

//     // Update user with reset token
//     await prisma.user.update({
//       where: { email },
//       data: {
//         resetToken,
//         resetTokenExpiry
//       }
//     });

// const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`
//     // For development, log the reset link

//     await transporter.sendMail({
//       from: `'Intellidoc Support' <${process.env.GMAIL_USER}`,
//       to: email,
//       subject: 'Password Reset Request',
//       text: `You requested a password reset. Use this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 15 minutes.`,
//         html: `<p>You requested a password reset. Click the link below to reset your password:</p>
//              <a href="${resetUrl}">${resetUrl}</a>
//              <p>This link expires in 15 minutes.</p>`
//     })



//     return res.json({
//       message: 'If this email exists in our system, a password reset link has been sent.'
//     });

//   } catch (error: any) {
//     console.error('Forgot password error:', error);
//     return res.status(500).json({ 
//       error: 'Internal server error',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });

// app.post('/api/auth/reset-password', async(req: Request, res: Response) => {
//   const token = req.query.token as string
//   const { newPassword} = req.body;

//     if (!token || !newPassword)
//     return res.status(400).json({ error: "Token and new password required" });

//     const user = await prisma.user.findFirst({
//       where: {
//        resetToken: token,
//        resetTokenExpiry: {gt: new Date()}
//       },
//     })

//     if (!user) return res.status(400).json({ error: 'Invalid or expired token'})

//       const hashed = await bcrypt.hash(newPassword, 10)

//       await prisma.user.update({
//         where: {id: user.id},
//         data: {
//           password: hashed,
//           resetToken: null,
//           resetTokenExpiry: null
//         }
//       })

//       return res.json({ message: 'Password reset successful' });
// })

// app.get("/api/documents", async (req: Request, res: Response) => {
//   try {
//     const documents = await prisma.document.findMany({
//       orderBy: { uploadedAt: "desc" },
//     });

//     res.json(documents);
//   } catch (error: any) {
//     console.error("Error fetching documents:", error);
//     res.status(500).json({
//       error: "Error fetching documents",
//       details: error.message,
//     });
//   }
// });


// app.get("/api/documents/:id", async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const document = await prisma.document.findUnique({
//       where: { id: id as string },
//     });

//     if (!document) {
//       return res.status(404).json({ error: "DOcument not found" });
//     }
//     res.json(document);
//   } catch (error: any) {
//     console.error("Get document error:", error);
//     res.status(500).json({ error: "Error fetching document" });
//   }
// });


// app.post(
//   "/api/documents/uploads",
//   upload.single("file"),
//   async (req: Request<{}, {}, UploadDocumentRequest>, res: Response) => {
//     try {
//       const { title } = req.body;
//       const file = req.file;

//       console.log("Upload request received:", {
//         title: title,
//         file: file
//           ? {
//               originalname: file.originalname,
//               mimetype: file.mimetype,
//               size: file.size,
//             }
//           : "No file",
//       });

//       if (!file) {
//         return res.status(400).json({ error: "No file uploaded" });
//       }
//       if (!title) {
//         return res.status(400).json({ error: "Missing title" });
//       }

//       const filePath = `documents/${Date.now()}_${file.originalname}`;

//       console.log("Uploading to Supabase storage...");

//       // Upload file buffer to Supabase Storage
//       const { data, error: uploadError } = await supabase.storage
//         .from("documents")
//         .upload(filePath, file.buffer, {
//           contentType: file.mimetype,
//           upsert: false,
//         });

//       if (uploadError) {
//         console.error("Supabase upload error:", uploadError);
//         return res
//           .status(500)
//           .json({ error: `Storage upload failed: ${uploadError.message}` });
//       }

//       // Get public URL for the uploaded file
//       const { data: publicUrlData } = supabase.storage
//         .from("documents")
//         .getPublicUrl(filePath);

//       console.log("File uploaded to Supabase, URL:", publicUrlData.publicUrl);

//       // Create document data without userId
//       const documentData: any = {
//         title: title || file.originalname,
//         fileUrl: publicUrlData.publicUrl,
//         fileType: file.mimetype,
//         textContent: "",
//         size: file.size,
//       };

//       // Save document record
//       const savedDoc = await prisma.document.create({
//         data: documentData,
//       });

//       console.log("Document saved to database successfully:", savedDoc.id);

//       // FIX: Use createdAt instead of uploadedAt
//       res.json({
//         id: savedDoc.id,
//         title: savedDoc.title,
//         fileUrl: savedDoc.fileUrl,
//         fileType: savedDoc.fileType,
//         uploadedAt: savedDoc.uploadedAt,
//         size: savedDoc.size,
//         // Changed from uploadedAt to createdAt
//         // Don't include userId in response
//       });
//     } catch (error: any) {
//       console.error("Upload error:", error);
//       res.status(500).json({
//         error: "Error uploading document",
//         details: error.message,
//       });
//     }
//   }
// );

// app.delete("/api/documents/:id", async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const document = await prisma.document.findUnique({
//       where: { id: id as string },
//     });
//     if (!document) {
//       return res.status(404).json({ error: "Document not found" });
//     }

//     const urlParts = document.fileUrl.split("/documents/");
//     const storagePath = `documents/${urlParts}`;

//     const { error: deleteError } = await supabase.storage
//       .from("documents")
//       .remove([storagePath]);

//     if (deleteError) {
//       console.error("Supabase deletion error:", deleteError);
//       return res
//         .status(500)
//         .json({ error: "Failed to delete file from storage" });
//     }

//     await prisma.document.delete({
//       where: { id: id as string },
//     });

//     res.json({
//       message: "Document deleted sucessfully",
//     });
//   } catch (error: any) {
//     console.error("Delete error:", error);
//     res.status(500).json({
//       error: "Error deleting document",
//       details: error.message,
//     });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
