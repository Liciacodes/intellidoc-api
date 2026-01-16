
interface CustomJwtPayload {
  userId: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: CustomJwtPayload;  
      userId?: string;          
    }
  }
}