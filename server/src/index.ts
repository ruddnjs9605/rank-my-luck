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

// 바디 파서 & 보안 & 로깅
app.use(express.json({ limit: '1mb' }));
app.use(helmet());
app.use(morgan('dev'));

// CORS 설정
const origin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin,
    credentials: true,
  })
);

// 쿠키 파서
app.use(cookieParser());

// 간단 레이트리밋 (10초에 100요청)
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// 헬스 체크
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// API 라우터
app.use('/api', routes);

// 정적 파일 (선택)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// 에러 핸들러
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
