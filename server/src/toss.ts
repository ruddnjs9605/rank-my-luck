// server/src/toss.ts
import axios from "axios";
import fs from "fs";
import https from "https";
import { createDecipheriv } from "crypto";
import { TossEncryptedPayload, EncryptedField } from "./types.js";

/* --------------------------------------------------------
 * 1) Toss OAuth2 엔드포인트 (토스 공식 최신 버전)
 * -------------------------------------------------------- */
const TOKEN_URL =
  process.env.TOSS_TOKEN_URL ||
  "https://partner-api.toss.im/api/v1/apps-in-toss/user/oauth2/generate-token";

const ME_URL =
  process.env.TOSS_ME_URL ||
  "https://partner-api.toss.im/api/v1/apps-in-toss/user/oauth2/login-me";

/* --------------------------------------------------------
 * 2) AES-GCM 복호화 키
 * -------------------------------------------------------- */
const KEY_RAW = process.env.TOSS_DECRYPTION_KEY!;
const KEY_FORMAT = (process.env.TOSS_KEY_FORMAT || "hex") as "hex" | "base64";

/* --------------------------------------------------------
 * 3) mTLS 인증서 로딩 (Cloud Run Secret Volume)
 * -------------------------------------------------------- */
const CERT_PATH = process.env.TOSS_MTLS_CERT_PATH; // ex: /secrets/cert/rankmyluck_public.crt
const KEY_PATH = process.env.TOSS_MTLS_KEY_PATH;   // ex: /secrets/key/rankmyluck_private.key

let httpsAgent: https.Agent | undefined = undefined;

try {
  console.log("[TOSS] Loading mTLS cert/key:", CERT_PATH, KEY_PATH);

  const cert = fs.readFileSync(CERT_PATH!);
  const key = fs.readFileSync(KEY_PATH!);

  httpsAgent = new https.Agent({
    cert,
    key,
  });

  console.log("[TOSS] mTLS httpsAgent initialized");
} catch (err) {
  console.error("[TOSS] ERROR loading mTLS files:", err);
}

/* --------------------------------------------------------
 * 4) AES-GCM 복호화 유틸
 * -------------------------------------------------------- */
function getKeyBuffer() {
  return KEY_FORMAT === "base64"
    ? Buffer.from(KEY_RAW, "base64")
    : Buffer.from(KEY_RAW, "hex");
}

function decryptField(field: EncryptedField) {
  try {
    const key = getKeyBuffer();
    const iv = Buffer.from(field.iv, "base64");
    const aad = Buffer.from(field.aad, "base64");
    const data = Buffer.from(field.data, "base64");
    const tag = Buffer.from(field.tag, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    const result = Buffer.concat([decipher.update(data), decipher.final()]);
    return result.toString("utf8");
  } catch (err) {
    console.error("[TOSS] ERROR decryptField:", err);
    throw err;
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
    authorization_code: authorizationCode, // Toss는 snake_case 요구
    referrer,
  };

  try {
    console.log("[TOSS] Request → generate-token:", TOKEN_URL);

    const resp = await axios.post(TOKEN_URL, body, {
      httpsAgent,
      timeout: 10_000,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    console.log("[TOSS] Response ← generate-token:", resp.data);
    return resp.data;
  } catch (err: any) {
    console.error(
      "[TOSS] ERROR generate-token:",
      err?.response?.data || err?.message
    );
    throw err;
  }
}

/* --------------------------------------------------------
 * 6) Access Token → Toss /login-me
 * -------------------------------------------------------- */
export async function fetchTossMe(
  accessToken: string
): Promise<TossEncryptedPayload> {
  try {
    console.log("[TOSS] Request → login-me:", ME_URL);

    const resp = await axios.get(ME_URL, {
      httpsAgent,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("[TOSS] Response ← login-me:", resp.data);
    return resp.data;
  } catch (err: any) {
    console.error("[TOSS] ERROR login-me:", err?.response?.data || err?.message);
    throw err;
  }
}

/* --------------------------------------------------------
 * 7) login-me 응답 payload 복호화 + appName 검증
 * -------------------------------------------------------- */
export async function decryptTossUser(payload: TossEncryptedPayload) {
  try {
    // 🔥 appName 체크 (필수)
    const expectedAppName = process.env.TOSS_APP_NAME; // ex: rankmyluck

    if (payload.appName !== expectedAppName) {
      console.error(
        `[TOSS] ERROR invalid appName: expected=${expectedAppName}, got=${payload.appName}`
      );
      throw new Error("INVALID_APP_NAME");
    }

    // 사용자 정보 복호화
    const tossUserKey = decryptField(payload.userKey);
    const phone = payload.phone ? decryptField(payload.phone) : null;
    const name = payload.name ? decryptField(payload.name) : null;

    return { tossUserKey, phone, name };
  } catch (err) {
    console.error("[TOSS] ERROR decryptTossUser:", err);
    throw err;
  }
}
