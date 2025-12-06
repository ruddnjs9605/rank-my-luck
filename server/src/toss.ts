// server/src/toss.ts
import axios from 'axios';
import { createDecipheriv } from 'node:crypto';
import https from 'node:https';
import { TossEncryptedPayload, EncryptedField } from './types.js';

// 토스 apps-in-toss 기본 URL (env로 덮어쓸 수 있음)
const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token';

const ME_URL =
  process.env.TOSS_ME_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me';

// 복호화 키 관련 env
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

// 🔐 mTLS용 인증서/키는 Secret Manager → env 로 들어온다고 가정
//  - TOSS_CLIENT_CERT: rankmyluck_public.crt 내용
//  - TOSS_CLIENT_KEY : rankmyluck_private.key 내용
const CLIENT_CERT = process.env.TOSS_CLIENT_CERT;
const CLIENT_KEY = process.env.TOSS_CLIENT_KEY;

let httpsAgent: https.Agent | undefined;

if (CLIENT_CERT && CLIENT_KEY) {
  httpsAgent = new https.Agent({
    cert: CLIENT_CERT,
    key: CLIENT_KEY,
  });
  console.log('[TOSS] mTLS httpsAgent initialized');
} else {
  console.warn('[TOSS] mTLS cert/key not configured – calling Toss API without client cert');
}

// =======================
// 내부 유틸 – 복호화
// =======================
function getKeyBuffer() {
  return KEY_FORMAT === 'base64'
    ? Buffer.from(KEY_RAW, 'base64')
    : Buffer.from(KEY_RAW, 'hex');
}

// AES-256-GCM 필드 하나 복호화
function decryptField(f: EncryptedField) {
  const key = getKeyBuffer();
  const iv = Buffer.from(f.iv, 'base64');
  const aad = Buffer.from(f.aad, 'base64');
  const data = Buffer.from(f.data, 'base64');
  const tag = Buffer.from(f.tag, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

// =======================
// 1) Authorization Code -> Access Token
// =======================
export async function exchangeCodeForToken(
  code: string,
  referrer?: string | null
) {
  const body = {
    // 🔴 중요: snake_case 로 보내야 토스가 인식함
    authorization_code: code,
    referrer,
  };

  const resp = await axios.post(
    TOKEN_URL,
    body,
    {
      timeout: 10_000,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );

  // 필요하면 디버깅용 로그 (배포 후 문제 없으면 제거해도 됨)
  console.log('[TOSS] generate-token resp:', resp.data);

  return resp.data;
}

// =======================
// 2) /login-me – 암호화된 payload 조회
// =======================
export async function fetchTossMe(
  accessToken: string
): Promise<TossEncryptedPayload> {
  const resp = await axios.get(ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 10_000,
    httpsAgent,
  });

  return resp.data as TossEncryptedPayload;
}

// =======================
// 3) payload 복호화 → 표준 유저 정보로 변환
// =======================
export async function decryptTossUser(payload: TossEncryptedPayload) {
  const tossUserKey = decryptField(payload.userKey);
  const phone = payload.phone ? decryptField(payload.phone) : null;
  const name = payload.name ? decryptField(payload.name) : null;

  return { tossUserKey, phone, name };
}
