import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_COOKIE = "apt-finder-auth";

export function getPassword(): string {
  return process.env.APP_PASSWORD || "apartment123";
}

export function verifyAuth(request: NextRequest): boolean {
  const cookie = request.cookies.get(AUTH_COOKIE);
  if (cookie?.value === getPassword()) return true;

  // Also check Authorization header for API calls
  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${getPassword()}`) return true;

  return false;
}

export function setAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE, getPassword(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
