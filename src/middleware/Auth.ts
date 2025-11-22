import {Request, Response, NextFunction} from 'express'
import jwt from 'jsonwebtoken'

export function requireAuth(req: Request, res:Response, next: NextFunction)  {
 const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Server misconfigured: missing JWT_SECRET" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach decoded user to request
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
