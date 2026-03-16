export interface SearchPreferences {
  minRooms: number;
  maxRooms: number;
  minPrice: number;
  maxPrice: number;
  minSqm: number;
  maxSqm: number;
  areas: string[]; // neighborhoods in Tel Aviv
  balcony: boolean;
  parking: boolean;
  mamad: boolean; // bomb shelter
  penthouse: boolean;
  condition: ("new" | "like-new" | "renovated" | "any")[];
  elevator: boolean;
  petFriendly: boolean;
  keywords: string[];
}

export interface Listing {
  id: string;
  source: "yad2" | "madlan" | "facebook" | "agent";
  title: string;
  description: string;
  price: number;
  rooms: number;
  sqm: number;
  floor: number;
  area: string; // neighborhood
  address: string;
  balcony: boolean;
  parking: boolean;
  mamad: boolean;
  elevator: boolean;
  condition: string;
  images: string[];
  url: string;
  agentName?: string;
  agentPhone?: string;
  postedAt: string;
  scrapedAt: string;
  similarityScore?: number;
}

export interface ExampleListing {
  url: string;
  notes: string; // why the user likes it
}

export interface UserConfig {
  preferences: SearchPreferences;
  examples: ExampleListing[];
  whatsappNumbers: string[];
  notifyInterval: number; // hours between notifications
  lastNotified: string;
  isActive: boolean;
}

export const DEFAULT_PREFERENCES: SearchPreferences = {
  minRooms: 2,
  maxRooms: 5,
  minPrice: 3000,
  maxPrice: 15000,
  minSqm: 40,
  maxSqm: 200,
  areas: ["תל אביב"],
  balcony: false,
  parking: false,
  mamad: false,
  penthouse: false,
  condition: ["any"],
  elevator: false,
  petFriendly: false,
  keywords: [],
};

export const DEFAULT_CONFIG: UserConfig = {
  preferences: DEFAULT_PREFERENCES,
  examples: [],
  whatsappNumbers: [],
  notifyInterval: 3,
  lastNotified: "",
  isActive: true,
};

export const TEL_AVIV_AREAS = [
  "תל אביב - כללי",
  "הצפון הישן",
  "הצפון החדש",
  "לב העיר",
  "פלורנטין",
  "נווה צדק",
  "יפו",
  "רמת אביב",
  "רמת אביב גימל",
  "נווה שרת",
  "אפקה",
  "בבלי",
  "כוכב הצפון",
  "נחלת בנימין",
  "רוטשילד",
  "שרונה",
  "שכונת התקווה",
  "כרם התימנים",
  "מונטיפיורי",
  "לב יפו",
  "צהלון",
  "נווה עופר",
  "עג'מי",
];
