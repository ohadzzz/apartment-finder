import * as cheerio from "cheerio";
import { Listing, SearchPreferences } from "../types";

const MADLAN_GQL_URL = "https://www.madlan.co.il/api2";

function buildMadlanQuery(prefs: SearchPreferences) {
  return {
    operationName: "SearchResultsQuery",
    variables: {
      filterBy: {
        dealType: "rent",
        city: "תל אביב יפו",
        minPrice: prefs.minPrice || undefined,
        maxPrice: prefs.maxPrice || undefined,
        minRooms: prefs.minRooms || undefined,
        maxRooms: prefs.maxRooms || undefined,
        minArea: prefs.minSqm || undefined,
        maxArea: prefs.maxSqm || undefined,
        hasParking: prefs.parking || undefined,
        hasMamad: prefs.mamad || undefined,
        hasBalcony: prefs.balcony || undefined,
        hasElevator: prefs.elevator || undefined,
        propertyTypes: prefs.penthouse
          ? ["apartment", "penthouse"]
          : ["apartment"],
      },
      sort: "date",
      page: 1,
    },
    query: `
      query SearchResultsQuery($filterBy: SearchFilterInput!, $sort: String, $page: Int) {
        searchResults(filterBy: $filterBy, sort: $sort, page: $page) {
          items {
            id
            address
            neighborhood
            price
            rooms
            area
            floor
            description
            images
            balcony
            parking
            mamad
            elevator
            condition
            dateAdded
            contactName
            contactPhone
            url
          }
          totalCount
        }
      }
    `,
  };
}

export async function searchMadlan(prefs: SearchPreferences): Promise<Listing[]> {
  // Try GraphQL API first
  try {
    const listings = await searchMadlanApi(prefs);
    if (listings.length > 0) return listings;
  } catch (error) {
    console.error("Madlan API failed:", error);
  }

  // Fall back to HTML scraping
  return scrapeMadlanHtml(prefs);
}

async function searchMadlanApi(prefs: SearchPreferences): Promise<Listing[]> {
  const query = buildMadlanQuery(prefs);

  const response = await fetch(MADLAN_GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
      Referer: "https://www.madlan.co.il/",
      Origin: "https://www.madlan.co.il",
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error(`Madlan API: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.data?.searchResults?.items || [];

  return items.map((item: any) => ({
    id: `madlan_${item.id}`,
    source: "madlan" as const,
    title: item.address || "",
    description: item.description || "",
    price: item.price || 0,
    rooms: item.rooms || 0,
    sqm: item.area || 0,
    floor: item.floor || 0,
    area: item.neighborhood || "",
    address: item.address || "",
    balcony: Boolean(item.balcony),
    parking: Boolean(item.parking),
    mamad: Boolean(item.mamad),
    elevator: Boolean(item.elevator),
    condition: item.condition || "",
    images: item.images || [],
    url: item.url
      ? `https://www.madlan.co.il${item.url}`
      : "https://www.madlan.co.il/",
    agentName: item.contactName,
    agentPhone: item.contactPhone,
    postedAt: item.dateAdded || new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
  }));
}

async function scrapeMadlanHtml(prefs: SearchPreferences): Promise<Listing[]> {
  // Build URL with search params
  const params = new URLSearchParams();
  params.set("dealType", "rent");
  params.set("city", "תל אביב יפו");
  if (prefs.minPrice) params.set("minPrice", String(prefs.minPrice));
  if (prefs.maxPrice) params.set("maxPrice", String(prefs.maxPrice));
  if (prefs.minRooms) params.set("minRooms", String(prefs.minRooms));
  if (prefs.maxRooms) params.set("maxRooms", String(prefs.maxRooms));

  const url = `https://www.madlan.co.il/rent/תל-אביב-יפו?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: Listing[] = [];

    // Madlan renders with React - try to find __NEXT_DATA__ or embedded JSON
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const results =
          nextData?.props?.pageProps?.searchResults?.items ||
          nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.items ||
          [];

        for (const item of results) {
          listings.push({
            id: `madlan_${item.id || item.docId || Date.now()}_${listings.length}`,
            source: "madlan",
            title: item.address || item.street || "",
            description: item.description || "",
            price: item.price || 0,
            rooms: item.rooms || 0,
            sqm: item.area || item.squareMeters || 0,
            floor: item.floor || 0,
            area: item.neighborhood || item.area_name || "",
            address: item.address || "",
            balcony: Boolean(item.balcony),
            parking: Boolean(item.parking),
            mamad: Boolean(item.mamad),
            elevator: Boolean(item.elevator),
            condition: item.condition || "",
            images: item.images || [],
            url: `https://www.madlan.co.il/listing/${item.id || item.docId || ""}`,
            postedAt: item.dateAdded || new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Failed to parse Madlan __NEXT_DATA__:", e);
      }
    }

    // Also try scraping visible HTML elements
    $("[class*='listing'], [class*='card'], [data-testid*='listing']").each(
      (i, el) => {
        const $el = $(el);
        const title = $el.find("[class*='address'], [class*='title']").first().text().trim();
        const price = $el.find("[class*='price']").first().text().trim();
        const link = $el.find("a").first().attr("href") || "";

        if (title && price) {
          listings.push({
            id: `madlan_html_${Date.now()}_${i}`,
            source: "madlan",
            title,
            description: "",
            price: parseInt(price.replace(/[^\d]/g, "")) || 0,
            rooms: 0,
            sqm: 0,
            floor: 0,
            area: "",
            address: title,
            balcony: false,
            parking: false,
            mamad: false,
            elevator: false,
            condition: "",
            images: [],
            url: link.startsWith("http") ? link : `https://www.madlan.co.il${link}`,
            postedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
          });
        }
      },
    );

    return listings;
  } catch (error) {
    console.error("Madlan HTML scrape failed:", error);
    return [];
  }
}
