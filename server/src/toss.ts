// server/src/toss.ts
import axios from 'axios';
import { createDecipheriv } from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import { TossEncryptedPayload, EncryptedField } from './types.js';

// 토스 기본 URL
const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token';

const ME_URL =
  process.env.TOSS_ME_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me';

// AES 복호화 키
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

// 🔐 mTLS 경로 = Cloud Run 환경변수로 전달됨
// ex) /etc/secrets/toss_cert/rankmyluck_public.crt
const CERT_PATH = process.env.TOSS_CLIENT_CERT_PATH;
const KEY_PATH = process.env.TOSS_CLIENT_KEY_PATH;

let httpsAgent: https.Agent | undefined = undefined;

try {
  if (CERT_PATH && KEY_PATH) {
    const cert = fs.readFileSync(CERT_PATH);
    const key = fs.readFileSync(KEY_PATH);

    httpsAgent = new https.Agent({
      cert,
      key,
    });

    console.log("[TOSS] mTLS httpsAgent initialized");
  } else {
    console.warn("[TOSS] mTLS cert/key path missing — check Cloud Run env vars");
  }
} catch (err) {
  console.error("[TOSS] Failed to load mTLS cert/key:", err);
}

// =======================
// 내부 복호화 유틸
// =======================
function getKeyBuffer() {
  return KEY_FORMAT === 'base64'
    ? Buffer.from(KEY_RAW, 'base64')
    : Buffer.from(KEY_RAW, 'hex');
}

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
// 1) Authorization Code → Access Token
// =======================
export async function exchangeCodeForToken(code: string, referrer?: string | null) {
  const body = {
    authorization_code: code,
    referrer,
  };

  const resp = await axios.post(TOKEN_URL, body, {
    httpsAgent,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  console.log("[TOSS] generate-token resp:", resp.data);
  return resp.data;
}

// =======================
// 2) accessToken → /login-me
// =======================
export async function fetchTossMe(accessToken: string): Promise<TossEncryptedPayload> {
  const resp = await axios.get(ME_URL, {
    httpsAgent,
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });

  return resp.data;
}

// =======================
// 3) payload 복호화
// =======================
export async function decryptTossUser(payload: TossEncryptedPayload) {
  const tossUserKey = decryptField(payload.userKey);
  const phone = payload.phone ? decryptField(payload.phone) : null;
  const name = payload.name ? decryptField(payload.name) : null;

  return { tossUserKey, phone, name };
}
