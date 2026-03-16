import * as cheerio from "cheerio";
import { Listing, SearchPreferences } from "../types";

/**
 * Madlan scraper.
 * Madlan (owned by Yad2) uses a complex GraphQL API (api3) that requires
 * session cookies and custom predicate-based queries. We attempt to fetch
 * the SSR HTML and extract embedded data from __SSR_HYDRATED_CONTEXT__.
 *
 * Note: Most Madlan rental listings overlap with Yad2 since they're the same company.
 */

export async function searchMadlan(prefs: SearchPreferences): Promise<Listing[]> {
  const url = buildMadlanUrl(prefs);
  console.log("[Madlan] Fetching:", url);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      console.error(`[Madlan] HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    return parseMadlanHtml(html);
  } catch (error) {
    console.error("[Madlan] Fetch failed:", error);
    return [];
  }
}

function buildMadlanUrl(prefs: SearchPreferences): string {
  // Madlan uses path-based routing: /for-rent/תל-אביב-יפו
  // Filters are applied via query params
  const params = new URLSearchParams();
  if (prefs.minPrice) params.set("minPrice", String(prefs.minPrice));
  if (prefs.maxPrice) params.set("maxPrice", String(prefs.maxPrice));
  if (prefs.minRooms) params.set("minRooms", String(prefs.minRooms));
  if (prefs.maxRooms) params.set("maxRooms", String(prefs.maxRooms));

  const base = "https://www.madlan.co.il/for-rent/%D7%AA%D7%9C-%D7%90%D7%91%D7%99%D7%91-%D7%99%D7%A4%D7%95";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function parseMadlanHtml(html: string): Listing[] {
  const listings: Listing[] = [];

  // Try to extract data from __SSR_HYDRATED_CONTEXT__ script
  const ssrMatch = html.match(/window\.__SSR_HYDRATED_CONTEXT__\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
  if (ssrMatch) {
    try {
      const ssrData = JSON.parse(ssrMatch[1]);
      const domainData = ssrData?.reduxInitialState?.domainData;

      // Look for bulletin/listing data in various places
      const possibleSources = [
        domainData?.searchResults,
        domainData?.bulletins,
        domainData?.marketplaceBulletins,
      ];

      for (const source of possibleSources) {
        if (source?.data && Array.isArray(source.data)) {
          for (const item of source.data) {
            const listing = parseMadlanItem(item);
            if (listing) listings.push(listing);
          }
        }
      }
    } catch (e) {
      console.error("[Madlan] Failed to parse SSR context:", e);
    }
  }

  // Also try parsing visible HTML elements with cheerio
  if (listings.length === 0) {
    const $ = cheerio.load(html);

    // Look for any structured data (JSON-LD)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || "");
        if (data["@type"] === "ItemList" && data.itemListElement) {
          for (const item of data.itemListElement) {
            const listing = parseMadlanJsonLd(item);
            if (listing) listings.push(listing);
          }
        }
      } catch {}
    });
  }

  console.log(`[Madlan] Parsed ${listings.length} listings`);
  return listings;
}

function parseMadlanItem(item: any): Listing | null {
  if (!item) return null;

  try {
    return {
      id: `madlan_${item.id || item.docId || Date.now()}`,
      source: "madlan",
      title: item.address || item.streetName || "",
      description: item.description || "",
      price: item.price || 0,
      rooms: item.rooms || item.beds || 0,
      sqm: item.area || item.squareMeters || 0,
      floor: item.floor || 0,
      area: item.neighbourhood || item.neighborhood || "",
      address: item.address || "",
      balcony: Boolean(item.balcony),
      parking: Boolean(item.parking),
      mamad: Boolean(item.mamad || item.safeRoom),
      elevator: Boolean(item.elevator),
      condition: item.generalCondition || item.condition || "",
      images: (item.images || []).map((img: any) =>
        typeof img === "string" ? img : img.imageUrl || img.url || ""
      ).filter(Boolean),
      url: item.url
        ? (item.url.startsWith("http") ? item.url : `https://www.madlan.co.il${item.url}`)
        : "https://www.madlan.co.il/",
      agentName: item.contactName,
      agentPhone: item.contactPhone,
      postedAt: item.firstTimeSeen || item.dateAdded || new Date().toISOString(),
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseMadlanJsonLd(item: any): Listing | null {
  if (!item?.item) return null;
  const data = item.item;

  try {
    return {
      id: `madlan_ld_${item.position || Date.now()}`,
      source: "madlan",
      title: data.name || "",
      description: data.description || "",
      price: parseInt(String(data.offers?.price || "0").replace(/[^\d]/g, "")) || 0,
      rooms: 0,
      sqm: 0,
      floor: 0,
      area: "",
      address: data.address?.streetAddress || "",
      balcony: false,
      parking: false,
      mamad: false,
      elevator: false,
      condition: "",
      images: data.image ? [data.image] : [],
      url: data.url || "https://www.madlan.co.il/",
      postedAt: new Date().toISOString(),
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
