// server/src/index.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const app = express();

// Cloud Run 프록시 헤더 허용
app.set('trust proxy', 1);

// 기본 미들웨어
app.use(express.json({ limit: '1mb' }));
app.use(helmet());
app.use(morgan('dev'));

// CORS
const origin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin,
    credentials: true,
  })
);

app.use(cookieParser());

// Rate limit
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// API 라우터
app.use('/api', routes);

// Static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Error handler
app.use(
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'INTERNAL', message: err?.message });
  }
);

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
