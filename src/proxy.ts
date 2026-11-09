import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAuthorizedApiRequest,
  checkRateLimit,
  RATE_LIMITS,
} from "./lib/api-security";

// Determine which rate limit bucket applies to the path
function getRateCategory(pathname: string): keyof typeof RATE_LIMITS {
  if (pathname.startsWith("/api/auth")) return "auth";
  if (pathname.startsWith("/api/keys")) return "keys";
  if (pathname.startsWith("/api/crypto")) return "crypto";
  if (pathname.startsWith("/api/upload")) return "upload";
  if (pathname.startsWith("/api/messages")) return "messages";
  if (pathname.startsWith("/api/push")) return "push";
  return "default";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* endpoints
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname === "/api/push/firebase-config") {
    return NextResponse.next();
  }

  // 1. THIRD-PARTY BLOCKING: Verify client origin / secret token
  const authCheck = isAuthorizedApiRequest(request);
  if (!authCheck.authorized) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Forbidden: Third-party access denied. This API is confidential and restricted.",
        reason: authCheck.reason,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      }
    );
  }

  // 2. EXTRACT CLIENT IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

  // 3. RATE LIMITING
  const category = getRateCategory(pathname);
  const rateResult = checkRateLimit(clientIp, category);

  if (!rateResult.allowed) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Too Many Requests: Rate limit exceeded. Please wait before retrying.",
        retryAfter: rateResult.resetInSec,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateResult.resetInSec),
          "X-RateLimit-Limit": String(rateResult.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateResult.resetInSec),
        },
      }
    );
  }

  // 4. ATTACH SECURITY HEADERS TO ALLOWED RESPONSES
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(rateResult.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateResult.remaining));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
