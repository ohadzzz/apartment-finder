import * as cheerio from "cheerio";
import { Listing, SearchPreferences } from "../types";

const YAD2_API_BASE = "https://gw.yad2.co.il/feed-search-legacy/realestate/rent";

function buildYad2Params(prefs: SearchPreferences): URLSearchParams {
  const params = new URLSearchParams();
  // Tel Aviv area code
  params.set("city", "5000");
  params.set("topArea", "2"); // Tel Aviv area
  params.set("area", "1"); // Tel Aviv city

  if (prefs.minRooms) params.set("rooms", `${prefs.minRooms}-${prefs.maxRooms}`);
  if (prefs.minPrice) params.set("price", `${prefs.minPrice}-${prefs.maxPrice}`);
  if (prefs.minSqm) params.set("squaremeter", `${prefs.minSqm}-${prefs.maxSqm}`);
  if (prefs.balcony) params.set("balcony", "1");
  if (prefs.parking) params.set("parking", "1");
  if (prefs.mamad) params.set("roomsnum", "1"); // mamad filter
  if (prefs.elevator) params.set("elevator", "1");
  if (prefs.penthouse) params.set("propertyGroup", "apartments");

  // property types: 1=apartment, 3=penthouse, 49=duplex
  const types = ["1"];
  if (prefs.penthouse) types.push("3");
  params.set("property", types.join(","));

  return params;
}

export async function searchYad2(prefs: SearchPreferences): Promise<Listing[]> {
  const params = buildYad2Params(prefs);
  const url = `${YAD2_API_BASE}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.yad2.co.il/",
        Origin: "https://www.yad2.co.il",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Yad2 API error: ${response.status}`);
      return await scrapeYad2Html(prefs);
    }

    const data = await response.json();
    return parseYad2ApiResponse(data);
  } catch (error) {
    console.error("Yad2 API failed, falling back to HTML scraping:", error);
    return await scrapeYad2Html(prefs);
  }
}

function parseYad2ApiResponse(data: any): Listing[] {
  const listings: Listing[] = [];
  const items = data?.data?.feed?.feed_items || data?.feed_items || [];

  for (const item of items) {
    if (item.type === "ad" || item.type === "item") {
      try {
        const listing: Listing = {
          id: `yad2_${item.id || item.token}`,
          source: "yad2",
          title: item.title_1 || item.row_1 || "",
          description: item.title_2 || item.row_2 || "",
          price: parsePrice(item.price || item.row_3 || ""),
          rooms: parseFloat(item.rooms_text || item.Rooms_text || "0"),
          sqm: parseInt(item.square_meters || item.SquareMeter_text || "0"),
          floor: parseInt(item.floor_text || item.Floor_text || "0"),
          area: item.neighborhood || item.area_text || "",
          address: [item.street, item.house_number, item.city]
            .filter(Boolean)
            .join(" "),
          balcony: Boolean(item.balcony || item.Balcony_text),
          parking: Boolean(item.parking || item.Parking_text),
          mamad: Boolean(item.saferoom || item.SafeRoom_text),
          elevator: Boolean(item.elevator || item.Elevator_text),
          condition: item.AssetClassificationID_text || item.info_bar_items?.[0] || "",
          images: extractYad2Images(item),
          url: `https://www.yad2.co.il/item/${item.id || item.token}`,
          postedAt: item.date || item.DateAdded || new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        };

        if (item.contact_name) listing.agentName = item.contact_name;
        if (item.contact_phone) listing.agentPhone = item.contact_phone;

        listings.push(listing);
      } catch (e) {
        console.error("Failed to parse Yad2 item:", e);
      }
    }
  }

  return listings;
}

async function scrapeYad2Html(prefs: SearchPreferences): Promise<Listing[]> {
  const params = buildYad2Params(prefs);
  const url = `https://www.yad2.co.il/realestate/rent?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "he-IL,he;q=0.9",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: Listing[] = [];

    $("[data-testid='feed-item'], .feeditem, .feed_item").each((_, el) => {
      try {
        const $el = $(el);
        const id = $el.attr("data-id") || $el.attr("item-id") || `yad2_html_${Date.now()}_${_}`;
        const title = $el.find(".title, [class*='title']").first().text().trim();
        const priceText = $el.find(".price, [class*='price']").first().text().trim();
        const address = $el.find(".subtitle, [class*='address']").first().text().trim();
        const rooms = $el.find("[class*='rooms']").text().trim();
        const sqm = $el.find("[class*='square']").text().trim();
        const floor = $el.find("[class*='floor']").text().trim();
        const link = $el.find("a").first().attr("href") || "";

        listings.push({
          id: `yad2_${id}`,
          source: "yad2",
          title: title || address,
          description: "",
          price: parsePrice(priceText),
          rooms: parseFloat(rooms) || 0,
          sqm: parseInt(sqm) || 0,
          floor: parseInt(floor) || 0,
          area: "",
          address,
          balcony: false,
          parking: false,
          mamad: false,
          elevator: false,
          condition: "",
          images: [],
          url: link.startsWith("http") ? link : `https://www.yad2.co.il${link}`,
          postedAt: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        });
      } catch {}
    });

    return listings;
  } catch (error) {
    console.error("Yad2 HTML scrape failed:", error);
    return [];
  }
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^\d]/g, "");
  return parseInt(cleaned) || 0;
}

function extractYad2Images(item: any): string[] {
  if (item.images) {
    return item.images.map((img: any) =>
      typeof img === "string" ? img : img.src || img.url || "",
    ).filter(Boolean);
  }
  if (item.img_url) return [item.img_url];
  if (item.image) return [item.image];
  return [];
}
