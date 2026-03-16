import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/storage";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const config = await getConfig();

  // Merge incoming updates
  if (body.preferences) {
    config.preferences = { ...config.preferences, ...body.preferences };
  }
  if (body.examples !== undefined) {
    config.examples = body.examples;
  }
  if (body.whatsappNumbers !== undefined) {
    config.whatsappNumbers = body.whatsappNumbers;
  }
  if (body.notifyInterval !== undefined) {
    config.notifyInterval = body.notifyInterval;
  }
  if (body.isActive !== undefined) {
    config.isActive = body.isActive;
  }

  await saveConfig(config);
  return NextResponse.json(config);
}
