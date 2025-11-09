import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import routes from "./routes.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 간단 레이트리밋
app.use(rateLimit({ windowMs: 10 * 1000, limit: 100 }));

app.use(routes);

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});

app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ error: "INTERNAL", message: err?.message });
  });