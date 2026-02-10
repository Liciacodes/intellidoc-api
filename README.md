# Intellidoc - AI-Powered Document Assistant

A modern, responsive website for showcasing the Touki Grotesk font family by UDI Type Foundry.

## Project Overview
Intellidoc is a full-stack AI-powered document assistant that allows users to upload, manage, and interact with their documents through chat, summarization, and semantic search features. The application supports multiple document formats (PDF, DOCX, TXT) and provides intelligent insights using AI.

## Features
### Authentication & User Management
- User registration and login with JWT-based authentication
- Password reset via email
- Secure password change functionality
- User-specific document isolation

### Document Management
- Upload documents (PDF, DOCX, TXT, JSON)
- Automatic text extraction from uploaded files
- Document listing with metadata
- Individual document viewing and deletion
- Secure file storage with Supabase

### AI-Powered Document Intelligence
- Smart Summarization: Generate concise summaries of documents
- Q&A Chat: Ask questions about document content
- Key Points Extraction: Extract main points as bullet lists
- Context-aware responses: AI answers based solely on document content

## Tech Stack
- Node.js with Express.js - Server framework
- TypeScript - Type safety and better developer experience
- mPrisma - ORM for database operations
- PostgreSQL - Primary database (via Supabase)
- Supabase - File storage and database hosting
- Groq AI API - AI/LLM integration (using Llama 3.3-70B model)
- JWT - Authentication tokens
- bcryptjs - Password hashing
- multer - File upload handling
- pdf-parse & mammoth - Text extraction from PDF and DOCX files

## Setup & Installation
### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (or Supabase account)
- Groq API key

## 1. Clone the Repository
```
git clone <repository-url>
cd intellidoc
```

## 2. Install Dependencies
```
npm install
```

## 3. Environment Configuration
Create a .env file in the root directory with the following variables:
```
# Server
PORT=5000
NODE_ENV=development

# Database (Supabase)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-SUPABASE-REF].supabase.co:5432/postgres"

# Supabase
SUPABASE_URL="https://[YOUR-SUPABASE-REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Email Service (for password reset)
GMAIL_APP_USER="your-email@gmail.com"
GMAIL_APP_PASS="your-app-specific-password"

# AI Service (Groq)
GROQ_API_KEY="your-groq-api-key-here"
```

## 3. Database Setup


```
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Seed initial data
npx prisma db seed
```

## Start the Server
```
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

## API Endpoints
### Authentication (/api/auth)
- POST /register - Register new user
- POST /login - User login
- POST /forgot-password - Request password reset
- POST /reset-password - Reset password with token
- POST /change-password - Change password (authenticated)

## Document Management (/api/documents)
- GET / - List all user documents
- POST /uploads - Upload new document
- GET /:id - Get document details
- GET /:id/content - Get document text content
- DELETE /:id - Delete document
- POST /:id/summarize - Generate document summary
- POST /:id/ask - Ask question about document
- POST /:id/key-points - Extract key points
- POST /test-pdfreader - Test PDF extraction (debug)

##  Database Schema
```
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  documents Document[]
  resetToken String?
  resetTokenExpiry DateTime?
  createdAt DateTime @default(now())
}
```

##  Document Model
```
model Document {
  id          String   @id @default(cuid())
  title       String
  fileUrl     String
  fileType    String
  size        Int?
  textContent String?
  uploadedAt  DateTime @default(now())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
}
```

## Security Features
1. JWT Authentication: All protected routes require valid tokens
2. Password Hashing: bcryptjs for secure password storage
3. File Validation: MIME type and size checks
4. SQL Injection Prevention: Prisma ORM with parameterized queries
5. CORS Configuration: Restricts cross-origin requests

## Testing the API
### Quick Test with cURL
```
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Upload a document (with JWT token)
curl -X POST http://localhost:5000/api/documents/uploads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "title=My Document"
```


## Acknowledgments
- Groq for AI API access
- Supabase for database and storage
- Prisma for excellent ORM
- All open-source libraries used