// server/src/toss.ts
import axios from "axios";
import fs from "fs";
import https from "https";
import { createDecipheriv } from "crypto";
import type { EncryptedField, TossEncryptedPayload } from "./types.js";

/* --------------------------------------------------------
 * 1) Toss OAuth2 엔드포인트
 * -------------------------------------------------------- */
const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token";

const ME_URL =
  process.env.TOSS_ME_URL ||
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me";

/* --------------------------------------------------------
 * 2) AES-GCM 복호화 키
 * -------------------------------------------------------- */
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || "hex") as "hex" | "base64";

function getKeyBuffer() {
  return KEY_FORMAT === "base64"
    ? Buffer.from(KEY_RAW, "base64")
    : Buffer.from(KEY_RAW, "hex");
}

/* --------------------------------------------------------
 * 3) mTLS 인증서 로딩
 * -------------------------------------------------------- */
let httpsAgent: https.Agent | undefined = undefined;

try {
  const cert = fs.readFileSync(process.env.TOSS_MTLS_CERT_PATH!);
  const key = fs.readFileSync(process.env.TOSS_MTLS_KEY_PATH!);

  httpsAgent = new https.Agent({
    cert,
    key,
  });

  console.log("[TOSS] mTLS loaded");
} catch (err) {
  console.error("[TOSS] mTLS load failed:", err);
}

/* --------------------------------------------------------
 * 4) AES-GCM 공식 예제 방식 복호화
 * -------------------------------------------------------- */
export function decryptField(field: EncryptedField): string {
  const key = getKeyBuffer();
  const iv = Buffer.from(field.iv, "base64");
  const aad = Buffer.from(field.aad, "base64");
  const data = Buffer.from(field.data, "base64");
  const tag = Buffer.from(field.tag, "base64");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[TOSS] decrypt error:", err);
    throw new Error("DECRYPT_FAIL");
  }
}

/* --------------------------------------------------------
 * 5) Authorization Code → Access Token
 * -------------------------------------------------------- */
export async function exchangeCodeForToken(
  authorizationCode: string,
  referrer?: string | null
) {
  const body = {
    authorizationCode,
    clientId: process.env.TOSS_APP_NAME,
    referrer,
  };

  try {
    console.log("[TOSS] generate-token →", body);

    const resp = await axios.post(TOKEN_URL, body, {
      httpsAgent,
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    });

    console.log("[TOSS] generate-token success:", resp.data);
    return resp.data;
  } catch (err: any) {
    console.error("[TOSS] generate-token FAIL:", err?.response?.data || err);
    throw new Error("TOKEN_FAIL");
  }
}

/* --------------------------------------------------------
 * 6) Access Token → login-me
 * -------------------------------------------------------- */
export async function fetchTossMe(
  accessToken: string
): Promise<TossEncryptedPayload> {
  try {
    const resp = await axios.get(ME_URL, {
      httpsAgent,
      timeout: 10000,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log("[TOSS] login-me success:", resp.data);
    return resp.data;
  } catch (err: any) {
    console.error("[TOSS] login-me FAIL:", err?.response?.data || err);
    throw new Error("LOGIN_ME_FAIL");
  }
}

/* --------------------------------------------------------
 * 7) 암호화된 payload → 복호화
 * -------------------------------------------------------- */
export function decryptTossUser(payload: TossEncryptedPayload) {
  // ❗ 공식 예제 기준으로 appName 검증 없음 → 제거
  const tossUserKey = decryptField(payload.userKey);
  const name = payload.name ? decryptField(payload.name) : null;
  const phone = payload.phone ? decryptField(payload.phone) : null;

  return { tossUserKey, name, phone };
}
