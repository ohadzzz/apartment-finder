import * as cheerio from "cheerio";
import { Listing, SearchPreferences } from "../types";

// Search for real estate agents in Tel Aviv and their listings
const AGENT_SOURCES = [
  {
    name: "Yad2 Agents",
    url: "https://www.yad2.co.il/realestate/agent",
  },
];

interface AgentInfo {
  name: string;
  phone: string;
  agency: string;
  url: string;
}

export async function searchAgentListings(
  prefs: SearchPreferences,
): Promise<Listing[]> {
  const listings: Listing[] = [];

  // Search Yad2 for agent/broker listings specifically
  try {
    const yad2Listings = await searchYad2Agents(prefs);
    listings.push(...yad2Listings);
  } catch (error) {
    console.error("Agent search failed:", error);
  }

  return listings;
}

async function searchYad2Agents(prefs: SearchPreferences): Promise<Listing[]> {
  const params = new URLSearchParams();
  params.set("city", "5000");
  params.set("topArea", "2");
  params.set("area", "1");
  params.set("forceLd498", "2"); // broker listings
  if (prefs.minRooms) params.set("rooms", `${prefs.minRooms}-${prefs.maxRooms}`);
  if (prefs.minPrice) params.set("price", `${prefs.minPrice}-${prefs.maxPrice}`);

  const url = `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://www.yad2.co.il/",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.data?.feed?.feed_items || [];

    return items
      .filter(
        (item: any) =>
          item.type === "ad" &&
          (item.merchant || item.is_premium || item.contact_name),
      )
      .map((item: any) => ({
        id: `agent_${item.id || item.token}`,
        source: "agent" as const,
        title: item.title_1 || item.row_1 || "",
        description: item.title_2 || item.row_2 || "",
        price: parseInt(String(item.price || "0").replace(/[^\d]/g, "")) || 0,
        rooms: parseFloat(item.rooms_text || "0"),
        sqm: parseInt(item.square_meters || "0"),
        floor: parseInt(item.floor_text || "0"),
        area: item.neighborhood || "",
        address: [item.street, item.house_number, item.city]
          .filter(Boolean)
          .join(" "),
        balcony: Boolean(item.balcony),
        parking: Boolean(item.parking),
        mamad: Boolean(item.saferoom),
        elevator: Boolean(item.elevator),
        condition: item.AssetClassificationID_text || "",
        images: item.images?.map((img: any) => img.src || img) || [],
        url: `https://www.yad2.co.il/item/${item.id || item.token}`,
        agentName: item.contact_name || item.merchant_name || "",
        agentPhone: item.contact_phone || "",
        postedAt: item.date || new Date().toISOString(),
        scrapedAt: new Date().toISOString(),
      }));
  } catch (error) {
    console.error("Yad2 agent search failed:", error);
    return [];
  }
}

// Known real estate agencies in Tel Aviv
export const TEL_AVIV_AGENTS = [
  { name: "אנגלו סכסון", phone: "03-5468200", area: "תל אביב" },
  { name: "רימקס - RE/MAX", phone: "03-5275757", area: "תל אביב" },
  { name: "הומלנד", phone: "03-5222111", area: "תל אביב" },
  { name: "ארזים נכסים", phone: "03-5441144", area: "תל אביב" },
  { name: "קולדוול בנקר", phone: "03-5466464", area: "תל אביב" },
  { name: "אלון נכסים", phone: "03-5277770", area: "תל אביב" },
  { name: "Century 21", phone: "03-7444421", area: "תל אביב" },
  { name: "לוי נדל״ן", phone: "03-5162222", area: "תל אביב" },
];
