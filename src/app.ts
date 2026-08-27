import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {createAuthRouter} from "./routes/auth";
import documentRoutes from "./routes/documents";
import { PrismaClient } from "@prisma/client";

dotenv.config();
export const createApp = (prisma: PrismaClient) => {
  const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5000",
      "https://intellidocclient.netlify.app",
      "https://*.netlify.app",
      "https://intellidoc-api.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/api-health", (req, res) => {
  res.json({ status: "ok", message: "Intellidoc API is running" });
});

// Use routers
app.use("/api/auth", createAuthRouter(prisma));
app.use("/api/documents", documentRoutes);

return app;
}

const prisma = new PrismaClient();
const app = createApp(prisma);
export default app;
