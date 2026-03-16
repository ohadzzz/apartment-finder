import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname === "/api/auth" ||
    pathname === "/api/cron" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check auth cookie for dashboard and API routes
  const authCookie = request.cookies.get("apt-finder-auth");
  const password = process.env.APP_PASSWORD || "apartment123";

  if (authCookie?.value === password) {
    return NextResponse.next();
  }

  // Check Authorization header for API routes
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${password}`) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to login for non-API routes
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
