// toss.ts
import axios from 'axios';
import { createDecipheriv } from 'node:crypto';
import https from 'node:https';
import { TossEncryptedPayload, EncryptedField } from './types.js';

const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token';
const ME_URL =
  process.env.TOSS_ME_URL ||
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me';

const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

// 🔐 mTLS용 cert/key 를 **내용 그대로** env에서 받기
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
  console.warn('[TOSS] mTLS cert/key not configured');
}

// ===== 이하 기존 복호화 함수들은 그대로 =====
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

// Authorization Code -> Token
export async function exchangeCodeForToken(
  code: string,
  referrer?: string | null
) {
  const resp = await axios.post(
    TOKEN_URL,
    { authorizationCode: code, referrer },
    {
      timeout: 10000,
      httpsAgent, // 🔐 mTLS
    }
  );
  return resp.data;
}

// GET /me (암호화된 payload)
export async function fetchTossMe(
  accessToken: string
): Promise<TossEncryptedPayload> {
  const resp = await axios.get(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
    httpsAgent, // 🔐 mTLS
  });
  return resp.data as TossEncryptedPayload;
}

export async function decryptTossUser(payload: TossEncryptedPayload) {
  const tossUserKey = decryptField(payload.userKey);
  const phone = payload.phone ? decryptField(payload.phone) : null;
  const name = payload.name ? decryptField(payload.name) : null;

  return { tossUserKey, phone, name };
}
