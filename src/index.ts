
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
    methods: ["GET", "POST", "PUT", "DELETE", 'OPTIONS'],
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






















