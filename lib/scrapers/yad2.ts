import * as cheerio from "cheerio";
import { Listing, SearchPreferences } from "../types";

/**
 * Yad2 scraper - uses ScrapingBee or similar proxy to bypass ShieldSquare/PerimeterX,
 * then parses __NEXT_DATA__ from the SSR HTML page.
 *
 * If no SCRAPING_API_KEY is set, falls back to direct fetch (may not work from servers).
 */

// Known tag IDs from Yad2
const TAG_IDS = {
  MAMAD: 1009,
  PARKING: 1003,
  NEW_FROM_CONTRACTOR: 1000,
  BALCONY: 1011,
  ELEVATOR: 1014,
  AIR_CONDITIONING: 1004,
  RENOVATED: 1002,
  FURNISHED: 1012,
  ACCESSIBLE: 1015,
  PETS_ALLOWED: 1013,
  BARS: 1006,
  STORAGE: 1005,
  TERRACE: 1016,
};

function buildYad2Url(prefs: SearchPreferences): string {
  const params = new URLSearchParams();
  params.set("city", "5000");
  params.set("area", "1");

  if (prefs.minRooms) params.set("minRooms", String(prefs.minRooms));
  if (prefs.maxRooms) params.set("maxRooms", String(prefs.maxRooms));
  if (prefs.minPrice) params.set("minPrice", String(prefs.minPrice));
  if (prefs.maxPrice) params.set("maxPrice", String(prefs.maxPrice));
  if (prefs.minSqm) params.set("minSquaremeter", String(prefs.minSqm));
  if (prefs.maxSqm) params.set("maxSquaremeter", String(prefs.maxSqm));

  if (prefs.penthouse) {
    params.set("property", "1,3");
  }

  return `https://www.yad2.co.il/realestate/rent?${params.toString()}`;
}

async function fetchWithProxy(url: string): Promise<string> {
  const apiKey = process.env.SCRAPING_API_KEY;
  const apiProvider = process.env.SCRAPING_PROVIDER || "scrapingbee"; // scrapingbee | zenrows | scraperapi

  if (apiKey) {
    let proxyUrl: string;

    switch (apiProvider) {
      case "zenrows":
        proxyUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(url)}&js_render=true&premium_proxy=true`;
        break;
      case "scraperapi":
        proxyUrl = `http://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true&country_code=il`;
        break;
      case "scrapingbee":
      default:
        proxyUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&country_code=il`;
        break;
    }

    console.log(`[Yad2] Using ${apiProvider} proxy`);
    const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(45000) });

    if (!response.ok) {
      console.error(`[Yad2] Proxy returned ${response.status}`);
      throw new Error(`Proxy error: ${response.status}`);
    }

    return response.text();
  }

  // Direct fetch fallback (won't work from most servers due to bot protection)
  console.log("[Yad2] No SCRAPING_API_KEY set, trying direct fetch (may be blocked)");
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  const html = await response.text();

  // Check if we got a captcha page
  if (html.includes("ShieldSquare") || html.includes("perfdrive.com") || html.includes("carta.radware.com")) {
    console.error("[Yad2] Bot protection detected. Set SCRAPING_API_KEY env var to use a scraping proxy.");
    throw new Error("Bot protection - need scraping proxy");
  }

  return html;
}

export async function searchYad2(prefs: SearchPreferences): Promise<Listing[]> {
  const url = buildYad2Url(prefs);
  console.log("[Yad2] Target URL:", url);

  try {
    const html = await fetchWithProxy(url);
    return parseYad2Html(html, prefs);
  } catch (error) {
    console.error("[Yad2] Failed:", error);
    return [];
  }
}

function parseYad2Html(html: string, prefs: SearchPreferences): Listing[] {
  const $ = cheerio.load(html);
  const nextDataScript = $("#__NEXT_DATA__").html();

  if (!nextDataScript) {
    console.error("[Yad2] No __NEXT_DATA__ found in HTML. HTML preview:", html.substring(0, 500));
    return [];
  }

  let nextData: any;
  try {
    nextData = JSON.parse(nextDataScript);
  } catch (e) {
    console.error("[Yad2] Failed to parse __NEXT_DATA__ JSON:", e);
    return [];
  }

  const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];

  // Find the feed query
  const feedQuery = queries.find((q: any) => {
    const keyStr = JSON.stringify(q.queryKey || "");
    return keyStr.includes("realestate-rent-feed") || keyStr.includes("rent-feed");
  });

  if (!feedQuery) {
    console.error("[Yad2] Feed query not found. Available queries:",
      queries.map((q: any) => JSON.stringify(q.queryKey).substring(0, 80)));
    return [];
  }

  const feedData = feedQuery.state?.data;
  if (!feedData) {
    console.error("[Yad2] No feed data in query");
    return [];
  }

  const listings: Listing[] = [];

  const categories = ["private", "agency", "yad1", "platinum", "kingOfTheHar", "trio", "booster", "leadingBroker"];
  for (const category of categories) {
    const items = feedData[category] || [];
    for (const item of items) {
      try {
        const listing = parseYad2Item(item, prefs);
        if (listing) listings.push(listing);
      } catch (e) {
        console.error("[Yad2] Failed to parse item:", e);
      }
    }
  }

  console.log(`[Yad2] Parsed ${listings.length} listings`);
  return listings;
}

function parseYad2Item(item: any, _prefs: SearchPreferences): Listing | null {
  const token = item.token;
  if (!token) return null;

  const address = item.address || {};
  const details = item.additionalDetails || {};
  const meta = item.metaData || {};
  const tags = item.tags || [];

  const tagIds = new Set(tags.map((t: any) => t.id));

  const hasBalcony = tagIds.has(TAG_IDS.BALCONY) || tagIds.has(TAG_IDS.TERRACE);
  const hasParking = tagIds.has(TAG_IDS.PARKING);
  const hasMamad = tagIds.has(TAG_IDS.MAMAD);
  const hasElevator = tagIds.has(TAG_IDS.ELEVATOR);

  const street = address.street?.text || "";
  const houseNum = address.house?.number || "";
  const neighborhood = address.neighborhood?.text || "";
  const city = address.city?.text || "תל אביב יפו";
  const fullAddress = [street, houseNum, neighborhood, city].filter(Boolean).join(", ");

  const conditionId = details.propertyCondition?.id;
  let condition = "";
  if (conditionId === 1) condition = "חדש מקבלן";
  else if (conditionId === 2) condition = "חדש";
  else if (conditionId === 3) condition = "משופץ";
  else if (conditionId === 4) condition = "במצב שמור";
  else if (conditionId === 5) condition = "דרוש שיפוץ";

  const listing: Listing = {
    id: `yad2_${token}`,
    source: "yad2",
    title: `${details.property?.text || "דירה"} - ${street || neighborhood}`,
    description: tags.map((t: any) => t.name).join(", "),
    price: item.price || 0,
    rooms: details.roomsCount || 0,
    sqm: details.squareMeter || 0,
    floor: address.house?.floor || 0,
    area: neighborhood,
    address: fullAddress,
    balcony: hasBalcony,
    parking: hasParking,
    mamad: hasMamad,
    elevator: hasElevator,
    condition,
    images: meta.images || (meta.coverImage ? [meta.coverImage] : []),
    url: `https://www.yad2.co.il/item/${token}`,
    postedAt: item.date || new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
  };

  if (item.contactName) listing.agentName = item.contactName;
  if (item.contactPhone) listing.agentPhone = item.contactPhone;

  return listing;
}
