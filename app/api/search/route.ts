import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getConfig, addListings, getListings } from "@/lib/storage";
import { searchYad2 } from "@/lib/scrapers/yad2";
import { searchMadlan } from "@/lib/scrapers/madlan";
import { searchFacebook } from "@/lib/scrapers/facebook";
import { searchAgentListings } from "@/lib/scrapers/agents";
import { rankListings } from "@/lib/matcher";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  const prefs = config.preferences;

  // Search all sources in parallel
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

  // Add new listings to storage
  const newListings = await addListings(allResults);

  // Rank all stored listings
  const allListings = await getListings();
  const ranked = rankListings(allListings, prefs, config.examples);

  return NextResponse.json({
    newCount: newListings.length,
    totalCount: allListings.length,
    sources: {
      yad2: yad2Results.status === "fulfilled" ? yad2Results.value.length : 0,
      madlan: madlanResults.status === "fulfilled" ? madlanResults.value.length : 0,
      facebook: fbResults.status === "fulfilled" ? fbResults.value.length : 0,
      agents: agentResults.status === "fulfilled" ? agentResults.value.length : 0,
    },
    listings: ranked.slice(0, 50),
  });
}
