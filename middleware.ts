import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const buf = Buffer.from(a);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Cron endpoint: require CRON_SECRET always
  if (pathname === "/api/cron") {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      );
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "APP_PASSWORD not configured" },
      { status: 500 },
    );
  }

  const expectedHash = hashToken(password);

  // Check auth cookie (stores hashed password, not plain)
  const authCookie = request.cookies.get("apt-finder-auth");
  if (authCookie?.value && safeCompare(authCookie.value, expectedHash)) {
    return NextResponse.next();
  }

  // Check Authorization header for API routes
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (safeCompare(token, password)) {
        return NextResponse.next();
      }
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to login for non-API routes
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
