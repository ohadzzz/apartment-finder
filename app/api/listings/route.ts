import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getListings, getConfig } from "@/lib/storage";
import { rankListings } from "@/lib/matcher";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  const listings = await getListings();
  const ranked = rankListings(listings, config.preferences, config.examples);

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const minScore = parseInt(searchParams.get("minScore") || "0");
  const limit = parseInt(searchParams.get("limit") || "50");

  let filtered = ranked;
  if (source) {
    filtered = filtered.filter((l) => l.source === source);
  }
  if (minScore > 0) {
    filtered = filtered.filter((l) => (l.similarityScore || 0) >= minScore);
  }

  return NextResponse.json({
    total: filtered.length,
    listings: filtered.slice(0, limit),
  });
}
