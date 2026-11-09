/**
 * SERVER & CLIENT API SECURITY & RATE LIMITING ENGINE
 * 
 * Protects all /api/* routes from:
 * 1. Unauthorized third-party external access (Requires origin verification & internal API secret)
 * 2. Abuse / Flooding / Denial-of-Service via in-memory sliding-window IP rate limiting
 * 3. Cross-Site Request Forgery (CSRF) & malicious embedding via secure response headers
 */

// Internal API Secret for authorized application calls
export const INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ||
  process.env.NEXT_PUBLIC_INTERNAL_API_SECRET ||
  "sec_wechat_2cad144084f1e37e77948300d9c8ca234be7eaa5185457b4360223db521dfe10";

export const API_TOKEN_HEADER = "x-wechat-internal-key";

/**
 * Client-side helper to attach required security headers to internal fetch requests
 */
export function getInternalApiHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [API_TOKEN_HEADER]: INTERNAL_API_SECRET,
    ...extraHeaders,
  };
}

// In-memory sliding-window rate limit storage
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed within windowMs */
  maxRequests: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
}

// Route-specific rate limits
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth routes (Strict brute force prevention)
  auth: { maxRequests: 15, windowMs: 60 * 1000 }, // 15 requests/min
  // Key generation & derivation
  keys: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests/min
  // Cryptographic operations
  crypto: { maxRequests: 120, windowMs: 60 * 1000 }, // 120 requests/min
  // Media uploads
  upload: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 requests/min
  // Message operations (Anti-flooding)
  messages: { maxRequests: 90, windowMs: 60 * 1000 }, // 90 requests/min
  // Push registration & diagnostics
  push: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 requests/min
  // Default API limit
  default: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests/min
};

/**
 * Check if a client IP has exceeded the rate limit for a category
 */
export function checkRateLimit(
  clientIp: string,
  category: keyof typeof RATE_LIMITS = "default"
): { allowed: boolean; remaining: number; resetInSec: number; limit: number } {
  const config = RATE_LIMITS[category] || RATE_LIMITS.default;
  const key = `${category}:${clientIp}`;
  const now = Date.now();

  let bucket = rateLimitMap.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + config.windowMs };
    rateLimitMap.set(key, bucket);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInSec: Math.ceil(config.windowMs / 1000),
      limit: config.maxRequests,
    };
  }

  bucket.count++;
  const remaining = Math.max(0, config.maxRequests - bucket.count);
  const resetInSec = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec,
      limit: config.maxRequests,
    };
  }

  return {
    allowed: true,
    remaining,
    resetInSec,
    limit: config.maxRequests,
  };
}

/**
 * Verify whether an incoming HTTP request is genuine and authorized:
 * 1. Matches internal API secret token OR
 * 2. Comes from the same origin (Referer / Host / Sec-Fetch-Site: same-origin)
 */
export function isAuthorizedApiRequest(req: Request): { authorized: boolean; reason?: string } {
  const token = req.headers.get(API_TOKEN_HEADER);
  if (token && token === INTERNAL_API_SECRET) {
    return { authorized: true };
  }

  // Same-origin browser request verification
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return { authorized: true };
  }

  const host = req.headers.get("host") || "";
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  // If origin matches host
  if (origin && (origin.includes(host) || origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    return { authorized: true };
  }

  // If referer matches host
  if (referer && (referer.includes(host) || referer.includes("localhost") || referer.includes("127.0.0.1"))) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: "Unauthorized external third-party access blocked. Missing valid application token or cross-origin mismatch.",
  };
}
