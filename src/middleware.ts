import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight check that the session token looks plausible.
 * better-auth tokens are typically UUIDs or base64 strings,
 * so we require a minimum length and only printable ASCII.
 */
function isValidSessionToken(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return false;
  // Session tokens should be at least 20 chars (UUIDs are 36, base64 tokens are longer)
  if (value.length < 20 || value.length > 500) return false;
  // Only allow printable ASCII characters commonly found in tokens
  return /^[A-Za-z0-9_\-=+/.]+$/.test(value);
}

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("better-auth.session_token");
  const hasValidSession = isValidSessionToken(sessionCookie?.value);

  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/posts") ||
    pathname.startsWith("/accounts") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/replies") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/notifications");

  const isProtectedApi = pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/stripe/webhook") &&
    !pathname.startsWith("/api/webhooks/threads");

  // Redirect unauthenticated users to login (browser pages)
  if (isProtectedRoute && !hasValidSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Return 401 JSON for API requests without a valid-looking session cookie
  if (isProtectedApi && !hasValidSession) {
    return NextResponse.json(
      { error: "認証が必要です" },
      { status: 401 },
    );
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && hasValidSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/posts/:path*",
    "/accounts/:path*",
    "/settings/:path*",
    "/ai/:path*",
    "/replies/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/api/:path*",
    "/login",
    "/register",
  ],
};
