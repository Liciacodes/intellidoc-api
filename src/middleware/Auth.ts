// src/middleware/Auth.ts - FIXED with proper TypeScript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log("🔐 [AUTH] Checking authentication...");
  
  // 1. Get authorization header (case-insensitive)
  const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string | undefined;
  
  if (!authHeader) {
    console.log("❌ [AUTH] No authorization header");
    return res.status(401).json({ error: "No token provided" });
  }
  
  console.log("🔐 [AUTH] Authorization header:", authHeader);
  
  // 2. Extract token from "Bearer <token>" format
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2) {
    console.log("❌ [AUTH] Invalid header format");
    return res.status(401).json({ error: "Invalid token format" });
  }
  
  const token = parts[1]; // This is definitely a string now
  
  if (!token) {
    console.log("❌ [AUTH] No token found after 'Bearer'");
    return res.status(401).json({ error: "Invalid token format" });
  }
  
  console.log("✅ [AUTH] Token extracted, length:", token.length);
  
  // 3. Get JWT secret
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.log(" [AUTH] JWT_SECRET missing");
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  // 4. Verify token
  try {
    console.log("🔐 [AUTH] Verifying token...");
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    console.log("[AUTH] Token valid for user:", decoded.userId);
    
    // Attach to request (TypeScript-safe way)
    (req as any).userId = decoded.userId;
    (req as any).user = decoded;
    
    next();
    
  } catch (err: any) {
    console.log(" [AUTH] Token verification failed:", err.message);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    
    return res.status(401).json({ error: "Invalid token" });
  }
}