import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log("🔐 [AUTH] Checking authentication...");
  console.log("🔐 [AUTH] Request method:", req.method);
  
  if (req.method === 'OPTIONS') {
    console.log("✅ [AUTH] Allowing OPTIONS preflight request");
    return next();
  }
  
  const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string | undefined;
  
  if (!authHeader) {
    console.log("❌ [AUTH] No authorization header");
    return res.status(401).json({ error: "No token provided" });
  }
  
  console.log("🔐 [AUTH] Authorization header:", authHeader);
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2) {
    console.log("❌ [AUTH] Invalid header format");
    return res.status(401).json({ error: "Invalid token format" });
  }
  
  const token = parts[1];
  
  if (!token) {
    console.log("❌ [AUTH] No token found after 'Bearer'");
    return res.status(401).json({ error: "Invalid token format" });
  }
  
  console.log("✅ [AUTH] Token extracted, length:", token.length);
  
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.log("❌ [AUTH] JWT_SECRET missing");
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  try {
    console.log("🔐 [AUTH] Verifying token...");
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    console.log("✅ [AUTH] Token valid for user:", decoded.userId);
    
    (req as any).userId = decoded.userId;
    (req as any).user = decoded;
    
    next();
    
  } catch (err: any) {
    console.log("❌ [AUTH] Token verification failed:", err.message);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    
    return res.status(401).json({ error: "Invalid token" });
  }
}