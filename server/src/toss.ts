import { createDecipheriv } from 'node:crypto';
import { TossEncryptedPayload, EncryptedField } from './types.js';

const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || 'hex') as 'hex' | 'base64';

function getKeyBuffer() {
  return KEY_FORMAT === 'base64'
    ? Buffer.from(KEY_RAW, 'base64')
    : Buffer.from(KEY_RAW, 'hex');
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
