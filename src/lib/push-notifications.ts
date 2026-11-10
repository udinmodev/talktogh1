import crypto from "crypto";
import fs from "fs";
import { getDbPool } from "./db";
import { getSupabaseAdminClient, getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { WireMessage } from "./server-store";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_PUSH_TOKENS_PER_MESSAGE = 25;
const PUSH_TOKEN_MAX_LENGTH = 4096;

export interface StealthPushPayloadOptions {
  counter?: number;
  easy?: string;
}

export interface TalkTogetherPushResult {
  status: "sent" | "partial" | "skipped" | "not_configured" | "error";
  sent: number;
  failed: number;
  tokenCount?: number;
  lastError?: string;
  reason?: string;
}

export interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

const accessTokenCache = new Map<string, CachedAccessToken>();
const pendingAccessTokens = new Map<string, Promise<string>>();
const DISPATCH_DEDUPE_TTL_MS = 10 * 60 * 1000;
const dispatchedMessageIds = new Map<string, number>();

function pruneDispatchedMessageIds(now: number): void {
  for (const [id, timestamp] of dispatchedMessageIds.entries()) {
    if (now - timestamp > DISPATCH_DEDUPE_TTL_MS) {
      dispatchedMessageIds.delete(id);
    }
  }
}

const PUSH_DISPATCH_TABLE = "public.push_dispatch_log";
let pushDispatchTableReady: Promise<void> | null = null;

function ensurePushDispatchTable(pool: NonNullable<ReturnType<typeof getDbPool>>): Promise<void> {
  if (!pushDispatchTableReady) {
    pushDispatchTableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS ${PUSH_DISPATCH_TABLE} (
           message_id text PRIMARY KEY,
           sent_at timestamptz NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        pushDispatchTableReady = null;
        throw err;
      });
  }
  return pushDispatchTableReady;
}

/**
 * Durable cross-instance dedupe: claims the right to dispatch a push for a
 * message id exactly once. Falls back to the in-memory map if the DB is
 * unavailable so single-instance deployments still dedupe.
 */
async function claimPushDispatch(messageKey: string): Promise<boolean> {
  const now = Date.now();
  pruneDispatchedMessageIds(now);
  if (dispatchedMessageIds.has(messageKey)) return false;

  // Immediately record in memory to block any synchronous or near-instant races
  dispatchedMessageIds.set(messageKey, now);

  const pool = getDbPool();
  if (pool) {
    try {
      await ensurePushDispatchTable(pool);
      const res = await pool.query(
        `INSERT INTO ${PUSH_DISPATCH_TABLE} (message_id) VALUES ($1)
         ON CONFLICT (message_id) DO NOTHING
         RETURNING message_id`,
        [messageKey]
      );
      if (res.rows.length === 0) {
        return false;
      }

      // Occasional cleanup of stale claim rows (1% of dispatches)
      if (Math.random() < 0.01) {
        pool
          .query(`DELETE FROM ${PUSH_DISPATCH_TABLE} WHERE sent_at < now() - interval '7 days'`)
          .catch(() => undefined);
      }
    } catch (err) {
      console.warn("[Push] Dispatch dedupe notice:", err instanceof Error ? err.message : err);
    }
  }

  return true;
}

function cleanIdentifier(value: unknown): string {
  return String(value || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}

function normalizeCounter(counter: number | undefined): number {
  const value = Number(counter);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(999999, Math.floor(value));
}

function normalizeEasy(easy: string | undefined): string {
  const value = String(easy || "securely")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "")
    .slice(0, 24);
  return value || "securely";
}

/**
 * Builds the externally boring system-sync notification copy while preserving
 * the Talk Together member-facing hint.
 */
export function buildTalkTogetherNotificationBody(options: StealthPushPayloadOptions = {}): string {
  const counter = normalizeCounter(options.counter);
  const easy = normalizeEasy(options.easy);
  return `Talk background sync: ${counter} active nodes linked ${easy} via Together protocol.`;
}

function deriveStealthEasy(wire: WireMessage): string {
  if (wire.viewOnce || wire.securityType === "view_once" || wire.securityType === "confidential") {
    return "privately";
  }
  if (wire.disappearingDuration || wire.securityType === "disappearing") {
    return "temporarily";
  }
  return "securely";
}

export function isValidPushToken(token: string): boolean {
  return (
    token.length >= 20 &&
    token.length <= PUSH_TOKEN_MAX_LENGTH &&
    /^[A-Za-z0-9:_\-./+=~]+$/.test(token)
  );
}

function parseServiceAccountJson(raw: string): FirebaseCredentials | null {
  try {
    const parsed = JSON.parse(raw);
    const projectId = String(parsed.project_id || parsed.projectId || "").trim();
    const clientEmail = String(parsed.client_email || parsed.clientEmail || "").trim();
    const privateKey = String(parsed.private_key || parsed.privateKey || "")
      .replace(/\\n/g, "\n")
      .trim();

    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

export function getFirebaseCredentials(): FirebaseCredentials | null {
  const json =
    process.env.FCM_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (json) {
    const credentials = parseServiceAccountJson(json);
    if (credentials) return credentials;
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    try {
      const fileCredentials = parseServiceAccountJson(fs.readFileSync(credentialsPath, "utf-8"));
      if (fileCredentials) return fileCredentials;
    } catch {
      // Fall through to individual environment variables.
    }
  }

  const projectId = String(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      ""
  ).trim();
  const clientEmail = String(
    process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || ""
  ).trim();
  const privateKey = String(
    process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || ""
  )
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function createFirebaseJwt(credentials: FirebaseCredentials, scope: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope,
      aud: FCM_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), credentials.privateKey)
    .toString("base64url");
  return `${unsigned}.${signature}`;
}

async function requestFirebaseAccessToken(
  credentials: FirebaseCredentials,
  scope: string
): Promise<string> {
  const response = await fetch(FCM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createFirebaseJwt(credentials, scope),
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase OAuth token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Firebase OAuth token response did not include an access token.");
  }

  const ttlMs = Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  accessTokenCache.set(scope, {
    token: data.access_token,
    expiresAt: Date.now() + ttlMs,
  });
  return data.access_token;
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const cached = accessTokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const pending = pendingAccessTokens.get(scope);
  if (pending) return pending;

  const credentials = getFirebaseCredentials();
  if (!credentials) {
    throw new Error("Firebase service account credentials are not configured.");
  }

  const request = requestFirebaseAccessToken(credentials, scope).finally(() => {
    pendingAccessTokens.delete(scope);
  });
  pendingAccessTokens.set(scope, request);
  return request;
}

function configuredEnvironmentTokens(): string[] {
  const raw =
    process.env.FCM_DEVICE_TOKENS ||
    process.env.FIREBASE_DEVICE_TOKENS ||
    "";
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((token) => token.trim())
        .filter(isValidPushToken)
    )
  );
}

async function fetchDatabaseTokens(userId: string, senderId: string): Promise<string[]> {
  const tokens = new Set<string>();
  const pool = getDbPool();

  if (pool) {
    try {
      const result = userId === "__all__"
        ? await pool.query(
            `SELECT token FROM public.push_tokens
             WHERE lower(user_id) <> $1
             ORDER BY last_seen_at DESC
             LIMIT $2`,
            [senderId, MAX_PUSH_TOKENS_PER_MESSAGE]
          )
        : await pool.query(
            `SELECT token FROM public.push_tokens
             WHERE lower(user_id) = $1
             ORDER BY last_seen_at DESC
             LIMIT $2`,
            [userId, MAX_PUSH_TOKENS_PER_MESSAGE]
          );

      for (const row of result.rows) {
        const token = String(row.token || "").trim();
        if (isValidPushToken(token)) tokens.add(token);
      }
    } catch (err) {
      console.warn("[Push] Push token lookup notice:", err instanceof Error ? err.message : err);
    }
  }

  if (!isSupabaseConfigured) return Array.from(tokens);

  try {
    const client = getSupabaseAdminClient() || getSupabaseClient();
    if (!client) return Array.from(tokens);

    let query = client.from("push_tokens").select("token").limit(MAX_PUSH_TOKENS_PER_MESSAGE);
    query = userId === "__all__"
      ? query.neq("user_id", senderId)
      : query.eq("user_id", userId);

    const { data, error } = await query;
    if (!error && data) {
      for (const row of data as Array<{ token?: string }>) {
        const token = String(row.token || "").trim();
        if (isValidPushToken(token)) tokens.add(token);
      }
    }
  } catch (err) {
    console.warn("[Push] Supabase token lookup notice:", err instanceof Error ? err.message : err);
  }

  return Array.from(tokens);
}

async function getRecipientTokens(recipientId: string, senderId: string): Promise<string[]> {
  const databaseTokens = await fetchDatabaseTokens(recipientId, senderId);
  if (databaseTokens.length > 0) {
    return databaseTokens.slice(0, MAX_PUSH_TOKENS_PER_MESSAGE);
  }
  return configuredEnvironmentTokens().slice(0, MAX_PUSH_TOKENS_PER_MESSAGE);
}

async function removeInvalidToken(token: string): Promise<void> {
  const pool = getDbPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM public.push_tokens WHERE token = $1", [token]);
      return;
    } catch {}
  }

  if (!isSupabaseConfigured) return;
  try {
    const client = getSupabaseAdminClient() || getSupabaseClient();
    if (client) {
      await client.from("push_tokens").delete().eq("token", token);
    }
  } catch {}
}

function isUnregisteredTokenError(status: number, body: string): boolean {
  return (
    status === 404 ||
    status === 410 ||
    body.includes("UNREGISTERED") ||
    body.includes("NotRegistered") ||
    body.includes("registration-token-not-registered")
  );
}

export interface TalkTogetherPushPayloadOptions extends StealthPushPayloadOptions {
  token: string;
  messageId?: string;
  senderId?: string;
  recipientId?: string;
  timestamp?: number;
}

/**
 * Generates the complete Firebase Cloud Messaging payload while keeping the
 * visible notification deliberately generic.
 */
export function buildTalkTogetherPushPayload(options: TalkTogetherPushPayloadOptions) {
  const body = buildTalkTogetherNotificationBody(options);
  const senderId = cleanIdentifier(options.senderId);
  const recipientId = cleanIdentifier(options.recipientId);
  const messageId = cleanIdentifier(options.messageId) || `msg-${Date.now()}`;

  return {
    message: {
      token: options.token,
      // Data-only payload: Never include top-level message.notification!
      // In FCM v1, top-level notification causes browsers to automatically show
      // an uncustomized notification AND invoke onBackgroundMessage (which calls
      // showNotification), causing dual/double notifications on Web & Android PWA.
      data: {
        type: "message_sync",
        event: "new_message",
        protocol: "talk_together",
        messageId,
        senderId,
        recipientId,
        timestamp: String(options.timestamp || Date.now()),
        title: "System Sync",
        body,
      },
      android: {
        priority: "HIGH",
        ttl: "3600s",
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: "System Sync",
              body,
            },
            sound: "default",
          },
        },
      },
      webpush: {
        headers: {
          TTL: "3600",
          Urgency: "high",
        },
      },
    },
  };
}

async function sendToToken(
  credentials: FirebaseCredentials,
  accessToken: string,
  payloadOptions: TalkTogetherPushPayloadOptions
): Promise<{ delivered: boolean; error?: string }> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildTalkTogetherPushPayload(payloadOptions)),
    }
  );

  if (response.ok) return { delivered: true };

  const errorText = await response.text().catch(() => "");
  if (isUnregisteredTokenError(response.status, errorText)) {
    await removeInvalidToken(payloadOptions.token);
  }
  const detail = errorText.replace(/\s+/g, " ").slice(0, 300);
  console.warn(`[Push] FCM send failed for one device with status ${response.status}: ${detail}`);
  return { delivered: false, error: `http_${response.status}: ${detail}` };
}

/**
 * Sends the stealth Talk Together push notification for a newly persisted
 * encrypted wire message. Never exposes plaintext message content.
 */
export async function triggerTalkTogetherPushNotification(
  wire: WireMessage
): Promise<TalkTogetherPushResult> {
  try {
    const recipientId = cleanIdentifier(wire.recipientId);
    const senderId = cleanIdentifier(wire.senderId);

    if (!recipientId || recipientId === "none" || recipientId === senderId) {
      return { status: "skipped", sent: 0, failed: 0, reason: "invalid_recipient" };
    }

    const isPublicChannel = recipientId.startsWith("public-");
    const tokenOwnerId = isPublicChannel ? "__all__" : recipientId;
    const tokens = await getRecipientTokens(tokenOwnerId, senderId);

    if (tokens.length === 0) {
      return { status: "skipped", sent: 0, failed: 0, tokenCount: 0, reason: "no_registered_tokens" };
    }

    const credentials = getFirebaseCredentials();
    if (!credentials) {
      return { status: "not_configured", sent: 0, failed: 0, tokenCount: tokens.length, reason: "firebase_credentials_missing" };
    }

    const accessToken = await getGoogleAccessToken(FCM_SCOPE);

    const messageKey = String(wire.id || "").trim();
    if (messageKey && !(await claimPushDispatch(messageKey))) {
      return { status: "skipped", sent: 0, failed: 0, tokenCount: tokens.length, reason: "duplicate_message" };
    }

    const payloadBase = {
      counter: tokens.length,
      easy: deriveStealthEasy(wire),
      messageId: wire.id,
      senderId: wire.senderId,
      recipientId: wire.recipientId,
      timestamp: wire.timestamp,
    };

    let sent = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const token of tokens) {
      try {
        const result = await sendToToken(credentials, accessToken, { ...payloadBase, token });
        if (result.delivered) sent += 1;
        else {
          failed += 1;
          lastError = result.error;
        }
      } catch (err) {
        failed += 1;
        lastError = err instanceof Error ? err.message : "fcm_request_failed";
        console.warn("[Push] FCM delivery notice:", err);
      }
    }

    return {
      status: failed === 0 ? "sent" : sent > 0 ? "partial" : "error",
      sent,
      failed,
      tokenCount: tokens.length,
      lastError,
    };
  } catch (err) {
    console.warn("[Push] Talk Together notification handler notice:", err instanceof Error ? err.message : err);
    return { status: "error", sent: 0, failed: 0, reason: "handler_exception" };
  }
}
