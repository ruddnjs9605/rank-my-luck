import axios from 'axios';
import { createDecipheriv } from 'node:crypto';
import { TossEncryptedPayload, EncryptedField } from './types.js';

const CLIENT_ID = process.env.TOSS_CLIENT_ID!;
const CLIENT_SECRET = process.env.TOSS_CLIENT_SECRET!;
const TOKEN_URL = process.env.TOSS_TOKEN_URL!;
const ME_URL = process.env.TOSS_ME_URL!;
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

function getKeyBuffer() {
  return KEY_FORMAT === 'base64'
    ? Buffer.from(KEY_RAW, 'base64')
    : Buffer.from(KEY_RAW, 'hex');
}

// Authorization Code -> Token
export async function exchangeCodeForToken(code: string) {
  const resp = await axios.post(
    TOKEN_URL,
    {
      grantType: 'authorization_code',
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code
    },
    { timeout: 10000 }
  );
  return resp.data;
}

// GET /me (암호화된 payload)
export async function fetchTossMe(accessToken: string): Promise<TossEncryptedPayload> {
  const resp = await axios.get(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000
  });
  return resp.data as TossEncryptedPayload;
}

// AES-256-GCM 복호화
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

// 토스 유저 표준화
export async function decryptTossUser(payload: TossEncryptedPayload) {
  const tossUserKey = decryptField(payload.userKey);
  const phone = payload.phone ? decryptField(payload.phone) : null;
  const name = payload.name ? decryptField(payload.name) : null;

  return { tossUserKey, phone, name };
}
