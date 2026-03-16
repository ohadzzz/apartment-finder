import { Listing, SearchPreferences } from "../types";

// Known Facebook groups for Tel Aviv apartment rentals
const FACEBOOK_GROUPS = [
  {
    name: "דירות להשכרה בתל אביב",
    id: "164138180289498",
    url: "https://www.facebook.com/groups/164138180289498",
  },
  {
    name: "דירות להשכרה בתל אביב - ללא תיווך",
    id: "1430498917188498",
    url: "https://www.facebook.com/groups/1430498917188498",
  },
  {
    name: "Rent Tel Aviv - דירות להשכרה בתל אביב",
    id: "297877953564975",
    url: "https://www.facebook.com/groups/297877953564975",
  },
  {
    name: "Secret Tel Aviv",
    id: "341754369178571",
    url: "https://www.facebook.com/groups/341754369178571",
  },
  {
    name: "דירות בתל אביב - Apartments in Tel Aviv",
    id: "236929389691498",
    url: "https://www.facebook.com/groups/236929389691498",
  },
  {
    name: "הומלס תל אביב - דירות לשכירות",
    id: "homeless.telaviv",
    url: "https://www.facebook.com/groups/homeless.telaviv",
  },
  {
    name: "Sublet and Apartments in TLV",
    id: "tlvrooms",
    url: "https://www.facebook.com/groups/tlvrooms",
  },
];

/**
 * Facebook scraping requires authentication and is against ToS.
 * Instead, we provide group links for manual checking and
 * support the Facebook Graph API if the user has a page token.
 *
 * For automated monitoring, we recommend using:
 * 1. Facebook Graph API with proper permissions
 * 2. RSS feeds if available
 * 3. Manual periodic checking via the dashboard
 */
export async function searchFacebook(
  prefs: SearchPreferences,
): Promise<Listing[]> {
  const fbToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!fbToken) {
    console.log(
      "No Facebook token configured. Facebook groups listed for manual checking.",
    );
    return [];
  }

  // If we have a token, try the Graph API
  return searchFacebookApi(prefs, fbToken);
}

async function searchFacebookApi(
  prefs: SearchPreferences,
  token: string,
): Promise<Listing[]> {
  const listings: Listing[] = [];

  for (const group of FACEBOOK_GROUPS) {
    try {
      const url = `https://graph.facebook.com/v18.0/${group.id}/feed?access_token=${token}&fields=message,created_time,permalink_url,from,attachments&limit=25`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      const posts = data?.data || [];

      for (const post of posts) {
        const message = post.message || "";
        if (!isRentalPost(message)) continue;

        const parsed = parseRentalPost(message, prefs);
        if (!parsed) continue;

        const images: string[] = [];
        if (post.attachments?.data) {
          for (const att of post.attachments.data) {
            if (att.media?.image?.src) images.push(att.media.image.src);
            if (att.subattachments?.data) {
              for (const sub of att.subattachments.data) {
                if (sub.media?.image?.src) images.push(sub.media.image.src);
              }
            }
          }
        }

        listings.push({
          id: `fb_${post.id}`,
          source: "facebook",
          title: parsed.title,
          description: message.slice(0, 500),
          price: parsed.price,
          rooms: parsed.rooms,
          sqm: parsed.sqm,
          floor: parsed.floor,
          area: parsed.area,
          address: parsed.address,
          balcony: parsed.balcony,
          parking: parsed.parking,
          mamad: parsed.mamad,
          elevator: parsed.elevator,
          condition: "",
          images,
          url: post.permalink_url || `${group.url}`,
          agentName: post.from?.name,
          postedAt: post.created_time || new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`Facebook group ${group.name} failed:`, error);
    }
  }

  return listings;
}

function isRentalPost(message: string): boolean {
  const keywords = [
    "להשכרה",
    "לשכירות",
    "for rent",
    "to rent",
    "שכירות",
    "חדרים",
    "rooms",
    "₪",
    "שח",
    "NIS",
    "מ״ר",
    "sqm",
  ];
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

interface ParsedPost {
  title: string;
  price: number;
  rooms: number;
  sqm: number;
  floor: number;
  area: string;
  address: string;
  balcony: boolean;
  parking: boolean;
  mamad: boolean;
  elevator: boolean;
}

function parseRentalPost(message: string, prefs: SearchPreferences): ParsedPost | null {
  // Extract price: look for patterns like "5,000₪", "5000 שח", "NIS 5000"
  const priceMatch = message.match(
    /(\d[\d,]*)\s*(?:₪|שח|ש"ח|NIS|nis)/i,
  ) || message.match(/(?:₪|NIS|nis)\s*(\d[\d,]*)/i);
  const price = priceMatch
    ? parseInt(priceMatch[1].replace(/,/g, ""))
    : 0;

  // Extract rooms: "3 חדרים", "3.5 rooms", "3 חד'"
  const roomsMatch = message.match(
    /(\d+\.?\d*)\s*(?:חדרים|חד[\'׳]|rooms?)/i,
  );
  const rooms = roomsMatch ? parseFloat(roomsMatch[1]) : 0;

  // Extract sqm: "80 מ\"ר", "80 sqm", "80 מטר"
  const sqmMatch = message.match(
    /(\d+)\s*(?:מ[״"]ר|מטר|sqm|m2|מ"ר)/i,
  );
  const sqm = sqmMatch ? parseInt(sqmMatch[1]) : 0;

  // Extract floor: "קומה 3", "floor 3"
  const floorMatch = message.match(/(?:קומה|floor)\s*(\d+)/i);
  const floor = floorMatch ? parseInt(floorMatch[1]) : 0;

  // Check features
  const balcony = /מרפסת|balcony|mirpeset/i.test(message);
  const parking = /חני[ה|יה]|parking|חנייה/i.test(message);
  const mamad = /ממ[״"]ד|מרחב מוגן|mamad|safe\s*room/i.test(message);
  const elevator = /מעלית|elevator/i.test(message);

  // Extract area/neighborhood
  const areas = [
    "הצפון הישן", "הצפון החדש", "פלורנטין", "נווה צדק", "יפו",
    "רמת אביב", "בבלי", "לב העיר", "כרם התימנים", "רוטשילד",
    "שרונה", "מונטיפיורי", "אפקה", "נווה שרת",
  ];
  const area = areas.find((a) => message.includes(a)) || "";

  // First line as title
  const title = message.split("\n")[0].slice(0, 100);

  // Basic address extraction
  const addressMatch = message.match(
    /(?:רחוב|ברחוב|street)\s+([^\n,]+)/i,
  );
  const address = addressMatch ? addressMatch[1].trim() : "";

  return {
    title,
    price,
    rooms,
    sqm,
    floor,
    area,
    address,
    balcony,
    parking,
    mamad,
    elevator,
  };
}

export function getFacebookGroups() {
  return FACEBOOK_GROUPS;
}
