import { NextRequest, NextResponse } from "next/server";
import { getConfig, addListings, getListings, setLastNotified } from "@/lib/storage";
import { searchYad2 } from "@/lib/scrapers/yad2";
import { searchMadlan } from "@/lib/scrapers/madlan";
import { searchFacebook } from "@/lib/scrapers/facebook";
import { searchAgentListings } from "@/lib/scrapers/agents";
import { rankListings } from "@/lib/matcher";
import { notifyNewListings } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();

  if (!config.isActive) {
    return NextResponse.json({ message: "Search is paused" });
  }

  // Check if enough time has passed since last notification
  if (config.lastNotified) {
    const lastNotified = new Date(config.lastNotified);
    const hoursSince =
      (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);
    if (hoursSince < config.notifyInterval) {
      return NextResponse.json({
        message: `Skipping - only ${hoursSince.toFixed(1)}h since last notification (interval: ${config.notifyInterval}h)`,
      });
    }
  }

  const prefs = config.preferences;

  // Search all sources
  const [yad2Results, madlanResults, fbResults, agentResults] =
    await Promise.allSettled([
      searchYad2(prefs),
      searchMadlan(prefs),
      searchFacebook(prefs),
      searchAgentListings(prefs),
    ]);

  const allResults = [
    ...(yad2Results.status === "fulfilled" ? yad2Results.value : []),
    ...(madlanResults.status === "fulfilled" ? madlanResults.value : []),
    ...(fbResults.status === "fulfilled" ? fbResults.value : []),
    ...(agentResults.status === "fulfilled" ? agentResults.value : []),
  ];

  // Store and deduplicate
  const newListings = await addListings(allResults);

  if (newListings.length === 0) {
    return NextResponse.json({
      message: "No new listings found",
      searched: allResults.length,
    });
  }

  // Rank new listings
  const allListings = await getListings();
  const ranked = rankListings(newListings, prefs, config.examples);

  // Filter to good matches only (score >= 40)
  const goodMatches = ranked.filter((l) => (l.similarityScore || 0) >= 40);

  // Send notifications
  const notifyResults = await notifyNewListings(
    goodMatches.length > 0 ? goodMatches : ranked.slice(0, 5),
    config.whatsappNumbers,
  );

  await setLastNotified(new Date().toISOString());

  return NextResponse.json({
    newListings: newListings.length,
    goodMatches: goodMatches.length,
    totalSearched: allResults.length,
    notifications: notifyResults,
    sources: {
      yad2: yad2Results.status === "fulfilled" ? yad2Results.value.length : 0,
      madlan: madlanResults.status === "fulfilled" ? madlanResults.value.length : 0,
      facebook: fbResults.status === "fulfilled" ? fbResults.value.length : 0,
      agents: agentResults.status === "fulfilled" ? agentResults.value.length : 0,
    },
  });
}
