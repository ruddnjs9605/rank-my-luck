// server/src/toss.ts
import axios from 'axios';
import { createDecipheriv } from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import { TossEncryptedPayload, EncryptedField } from './types.js';

// =======================
// 토스 기본 URL
// =======================
const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token';

const ME_URL =
  process.env.TOSS_ME_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me';

// =======================
// AES 복호화 관련 설정
// =======================
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

// =======================
// 🔐 mTLS 인증서 경로 설정
// Cloud Run에서 환경변수 + fallback
// =======================
const CERT_PATH =
  process.env.TOSS_MTLS_CERT_PATH || "/secrets/cert/rankmyluck_public.crt";

const KEY_PATH =
  process.env.TOSS_MTLS_KEY_PATH || "/secrets/key/rankmyluck_private.key";

let httpsAgent: https.Agent | undefined = undefined;

try {
  console.log("[TOSS] Loading mTLS certificates...");
  console.log("CERT_PATH:", CERT_PATH);
  console.log("KEY_PATH:", KEY_PATH);

  const cert = fs.readFileSync(CERT_PATH);
  const key = fs.readFileSync(KEY_PATH);

  httpsAgent = new https.Agent({
    cert,
    key,
  });

  console.log("[TOSS] mTLS httpsAgent initialized successfully");
} catch (err: any) {
  console.error("[TOSS] ❌ Failed to load mTLS cert/key");
  console.error("CERT_PATH:", CERT_PATH);
  console.error("KEY_PATH:", KEY_PATH);
  console.error("Error:", err.message);
}

// =======================
// 내부 복호화 유틸 함수
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
  try {
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

  } catch (err: any) {
    console.error("[TOSS] ❌ Error in exchangeCodeForToken:", err.response?.data || err.message);
    throw err;
  }
}

// =======================
// 2) accessToken → /login-me
// =======================
export async function fetchTossMe(accessToken: string): Promise<TossEncryptedPayload> {
  try {
    const resp = await axios.get(ME_URL, {
      httpsAgent,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    return resp.data;

  } catch (err: any) {
    console.error("[TOSS] ❌ Error in fetchTossMe:", err.response?.data || err.message);
    throw err;
  }
}

// =======================
// 3) payload 복호화
// =======================
export async function decryptTossUser(payload: TossEncryptedPayload) {
  try {
    const tossUserKey = decryptField(payload.userKey);
    const phone = payload.phone ? decryptField(payload.phone) : null;
    const name = payload.name ? decryptField(payload.name) : null;

    return { tossUserKey, phone, name };

  } catch (err: any) {
    console.error("[TOSS] ❌ Error decrypting user payload:", err.message);
    throw err;
  }
}
