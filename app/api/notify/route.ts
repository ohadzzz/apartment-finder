import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getConfig, getListings, setLastNotified } from "@/lib/storage";
import { rankListings } from "@/lib/matcher";
import { notifyNewListings } from "@/lib/whatsapp";

// Manual trigger for sending notification
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  const listings = await getListings();
  const ranked = rankListings(listings, config.preferences, config.examples);
  const top = ranked.slice(0, 10);

  const results = await notifyNewListings(top, config.whatsappNumbers);
  await setLastNotified(new Date().toISOString());

  return NextResponse.json({
    message: `Sent ${top.length} listings to ${config.whatsappNumbers.length} numbers`,
    results,
  });
}
