import { NextRequest, NextResponse } from "next/server";
import { getPassword, setAuthCookie, clearAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (password === getPassword()) {
    const response = NextResponse.json({ success: true });
    return setAuthCookie(response);
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  return clearAuthCookie(response);
}
