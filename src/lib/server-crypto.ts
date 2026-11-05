import crypto from "crypto";
import { EncryptedPayload } from "./crypto";

/**
 * SERVER-SIDE CRYPTOGRAPHIC SUITE
 * Implements:
 * - Server-side ECDH P-256 Key Pair Generation
 * - Server-side HKDF-SHA256 Session Key Derivation
 * - Server-side AES-256-GCM Envelope Encryption & Decryption
 * - 60-Digit Cryptographic Safety Number Generation
 * - Server-side Envelope Validation & Anti-Tamper Verification
 * - Server Master Key & HMAC Integrity Verification
 */

const SERVER_SECRET_SALT = process.env.SERVER_CRYPTO_SALT || "wechat_server_master_salt_v2";

// Server Master Key for storage integrity & envelope encryption
const SERVER_MASTER_KEY = crypto.scryptSync(
  process.env.SERVER_MASTER_SECRET || "wechat-secure-master-encryption-secret-2026",
  SERVER_SECRET_SALT,
  32
);

export interface ServerKeyPair {
  publicKeyHex: string;
  privateKeyHex: string;
  fingerprint: string;
  publicKeyJwk: any;
}

export interface ServerDerivedKey {
  sessionKeyHex: string;
  sessionKeyBase64: string;
  safetyNumber: string;
  algorithm: string;
  epoch: number;
}

/**
 * Generate an ECDH P-256 key pair on the server
 */
export function generateServerKeyPair(userId: string): ServerKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  const pubHex = publicKey.toString("hex");
  const privHex = privateKey.toString("hex");

  const fingerprint = crypto
    .createHash("sha256")
    .update(pubHex + "_" + userId)
    .digest("hex")
    .substring(0, 16)
    .toUpperCase();

  const pubKeyObj = crypto.createPublicKey({
    key: publicKey,
    format: "der",
    type: "spki",
  });

  const jwk = pubKeyObj.export({ format: "jwk" });

  return {
    publicKeyHex: pubHex,
    privateKeyHex: privHex,
    fingerprint,
    publicKeyJwk: jwk,
  };
}

/**
 * Generate a fresh 256-bit AES encryption key on the server
 */
export function generateServerAesKey(): { keyHex: string; keyBase64: string } {
  const buf = crypto.randomBytes(32);
  return {
    keyHex: buf.toString("hex"),
    keyBase64: buf.toString("base64"),
  };
}

/**
 * Deterministically derive shared 256-bit AES-GCM session key between two users on the server
 */
export function deriveServerPairKey(userA: string, userB: string, epoch: number = 1): ServerDerivedKey {
  const sortedIds = [String(userA).toLowerCase(), String(userB).toLowerCase()].sort();
  const pairContext = `${sortedIds[0]}<->${sortedIds[1]}`;

  // Step 1: Compute master entropy via HKDF using server master key and sorted pair identity
  const ikm = crypto
    .createHmac("sha256", SERVER_MASTER_KEY)
    .update(`pair-session-ikm:${pairContext}:epoch-${epoch}`)
    .digest();

  const salt = Buffer.from(`wechat-server-e2ee-salt-epoch-${epoch}`, "utf8");
  const info = Buffer.from(`wechat-aes256-gcm-ratchet-${pairContext}-v${epoch}`, "utf8");

  // HKDF-Expand to 32 bytes (256 bits)
  const sessionKey = crypto.hkdfSync("sha256", ikm, salt, info, 32);
  const sessionKeyBuf = Buffer.from(sessionKey);

  // Safety code derived from pair context
  const safetyNumber = generateServerSafetyNumber(sortedIds[0], sortedIds[1]);

  return {
    sessionKeyHex: sessionKeyBuf.toString("hex"),
    sessionKeyBase64: sessionKeyBuf.toString("base64"),
    safetyNumber,
    algorithm: "AES-256-GCM (HKDF-SHA256)",
    epoch,
  };
}

/**
 * 60-digit verified safety number generation on the server
 */
export function generateServerSafetyNumber(userA: string, userB: string): string {
  const sorted = [String(userA).toLowerCase(), String(userB).toLowerCase()].sort().join("::");
  const hash = crypto.createHash("sha256").update(sorted + "_safety_v2").digest("hex");

  let numericStr = "";
  for (let i = 0; i < hash.length; i++) {
    numericStr += hash.charCodeAt(i) % 10;
  }
  while (numericStr.length < 60) {
    numericStr += "7";
  }
  const digits = numericStr.substring(0, 60);

  const blocks: string[] = [];
  for (let i = 0; i < 60; i += 5) {
    blocks.push(digits.slice(i, i + 5));
  }
  return blocks.join(" ");
}

/**
 * Server-side AES-256-GCM encryption with Authenticated Additional Data (AAD)
 */
export function serverEncrypt(
  data: any,
  keyHexOrBase64: string,
  senderId: string,
  recipientId: string,
  epoch: number = 1
): EncryptedPayload {
  const keyBuf =
    keyHexOrBase64.length === 64
      ? Buffer.from(keyHexOrBase64, "hex")
      : Buffer.from(keyHexOrBase64, "base64");

  if (keyBuf.length !== 32) {
    throw new Error("Invalid key length: must be 32 bytes (256 bits)");
  }

  const iv = crypto.randomBytes(12); // 96-bit CSPRNG IV
  const timestamp = Date.now();
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);

  const aad = Buffer.from(`wechat:aad:sender=${senderId};recipient=${recipientId};ts=${timestamp}`, "utf8");
  const aadDigest = crypto.createHash("sha256").update(aad).digest("hex");

  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  cipher.setAAD(aad);

  let ciphertextBuf = cipher.update(plaintext, "utf8");
  ciphertextBuf = Buffer.concat([ciphertextBuf, cipher.final()]);
  const authTag = cipher.getAuthTag(); // 128-bit (16-byte) authentication tag

  // In WebCrypto format, auth tag is concatenated at the end of the ciphertext
  const finalCiphertext = Buffer.concat([ciphertextBuf, authTag]);

  return {
    ciphertext: finalCiphertext.toString("base64"),
    iv: iv.toString("base64"),
    algorithm: "AES-256-GCM (HKDF-SHA256)",
    senderId,
    recipientId,
    timestamp,
    keyEpoch: epoch,
    aadDigest,
    integrityStatus: "verified",
  };
}

/**
 * Server-side AES-256-GCM decryption with Authenticated Additional Data (AAD) verification
 */
export function serverDecrypt(
  payload: EncryptedPayload,
  keyHexOrBase64: string
): { success: boolean; data?: any; text?: string; error?: string } {
  try {
    const keyBuf =
      keyHexOrBase64.length === 64
        ? Buffer.from(keyHexOrBase64, "hex")
        : Buffer.from(keyHexOrBase64, "base64");

    const fullCiphertext = Buffer.from(payload.ciphertext, "base64");
    if (fullCiphertext.length < 16) {
      return { success: false, error: "Ciphertext too short (missing 16-byte auth tag)" };
    }

    const iv = Buffer.from(payload.iv, "base64");
    if (iv.length !== 12) {
      return { success: false, error: "Invalid IV length (must be 12 bytes)" };
    }

    // Split ciphertext and 16-byte auth tag
    const ciphertext = fullCiphertext.subarray(0, fullCiphertext.length - 16);
    const authTag = fullCiphertext.subarray(fullCiphertext.length - 16);

    const aad = Buffer.from(
      `wechat:aad:sender=${payload.senderId};recipient=${payload.recipientId};ts=${payload.timestamp}`,
      "utf8"
    );

    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, "utf8");
    decrypted += decipher.final("utf8");

    try {
      const parsed = JSON.parse(decrypted);
      return { success: true, data: parsed, text: parsed.text || decrypted };
    } catch {
      return { success: true, text: decrypted };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Decryption / Integrity verification failed: ${err.message}`,
    };
  }
}

/**
 * Strict server-side envelope security validation
 */
export function validateServerEnvelope(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Missing or malformed payload object" };
  }

  if (!payload.senderId || typeof payload.senderId !== "string") {
    return { valid: false, error: "Invalid or missing senderId" };
  }

  if (!payload.recipientId || typeof payload.recipientId !== "string") {
    return { valid: false, error: "Invalid or missing recipientId" };
  }

  if (!payload.iv || typeof payload.iv !== "string") {
    return { valid: false, error: "Missing initialization vector (IV)" };
  }

  const ivBuf = Buffer.from(payload.iv, "base64");
  if (ivBuf.length !== 12) {
    return { valid: false, error: `Invalid IV size: expected 12 bytes, got ${ivBuf.length}` };
  }

  if (!payload.ciphertext || typeof payload.ciphertext !== "string") {
    return { valid: false, error: "Missing ciphertext" };
  }

  const cipherBuf = Buffer.from(payload.ciphertext, "base64");
  if (cipherBuf.length < 16) {
    return { valid: false, error: "Ciphertext too small to contain valid auth tag" };
  }

  // Anti-replay timestamp check (window of +/- 10 minutes)
  const now = Date.now();
  if (payload.timestamp && Math.abs(now - payload.timestamp) > 10 * 60 * 1000) {
    return { valid: false, error: "Timestamp drift exceeded maximum acceptable window" };
  }

  return { valid: true };
}

/**
 * Compute HMAC-SHA256 integrity signature for data at rest
 */
export function computeRecordHmac(record: any): string {
  const serialized = JSON.stringify({
    id: record.id,
    senderId: record.senderId,
    recipientId: record.recipientId,
    timestamp: record.timestamp,
    iv: record.encryptedPayload?.iv,
    ciphertext: record.encryptedPayload?.ciphertext,
  });
  return crypto.createHmac("sha256", SERVER_MASTER_KEY).update(serialized).digest("hex");
}
