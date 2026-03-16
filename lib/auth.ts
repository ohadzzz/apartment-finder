import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

const AUTH_COOKIE = "apt-finder-auth";

// In-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getPassword(): string {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    throw new Error("APP_PASSWORD environment variable is required");
  }
  return pw;
}

/** Hash a value with SHA-256 for cookie storage (don't store raw password in cookie) */
function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Timing-safe string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self to keep constant time, but return false
    const buf = Buffer.from(a);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyAuth(request: NextRequest): boolean {
  try {
    const password = getPassword();
    const expectedHash = hashToken(password);

    // Check auth cookie (stores hashed password)
    const cookie = request.cookies.get(AUTH_COOKIE);
    if (cookie?.value && safeCompare(cookie.value, expectedHash)) return true;

    // Check Authorization header for API calls
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (safeCompare(token, password)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  try {
    return safeCompare(input, getPassword());
  } catch {
    return false;
  }
}

export function setAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE, hashToken(getPassword()), {
    httpOnly: true,
    secure: true, // always secure — deployed on HTTPS
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days (reduced from 30)
    path: "/",
  });
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_COOKIE);
  return response;
}

/** Rate limit login attempts by IP. Returns true if allowed, false if blocked. */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_ATTEMPTS) return false;
    entry.count++;
    return true;
  }

  loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  return true;
}

export function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
