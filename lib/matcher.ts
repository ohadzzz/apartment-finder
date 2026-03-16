import { Listing, SearchPreferences, ExampleListing } from "./types";

/**
 * Score a listing against user preferences (0-100).
 * Higher = better match.
 */
export function scoreListing(
  listing: Listing,
  prefs: SearchPreferences,
): number {
  let score = 50; // base score
  let maxScore = 50;

  // Price range (most important)
  maxScore += 20;
  if (listing.price > 0) {
    if (listing.price >= prefs.minPrice && listing.price <= prefs.maxPrice) {
      score += 20;
    } else if (listing.price < prefs.minPrice) {
      score += 15; // under budget is good
    } else {
      const overBy = (listing.price - prefs.maxPrice) / prefs.maxPrice;
      score += Math.max(0, 10 - overBy * 50); // penalize over budget
    }
  }

  // Rooms
  maxScore += 15;
  if (listing.rooms > 0) {
    if (listing.rooms >= prefs.minRooms && listing.rooms <= prefs.maxRooms) {
      score += 15;
    } else {
      const diff = Math.min(
        Math.abs(listing.rooms - prefs.minRooms),
        Math.abs(listing.rooms - prefs.maxRooms),
      );
      score += Math.max(0, 10 - diff * 5);
    }
  }

  // Sqm
  maxScore += 10;
  if (listing.sqm > 0) {
    if (listing.sqm >= prefs.minSqm && listing.sqm <= prefs.maxSqm) {
      score += 10;
    }
  }

  // Required features
  if (prefs.balcony) {
    maxScore += 10;
    if (listing.balcony) score += 10;
  }

  if (prefs.parking) {
    maxScore += 10;
    if (listing.parking) score += 10;
  }

  if (prefs.mamad) {
    maxScore += 10;
    if (listing.mamad) score += 10;
  }

  if (prefs.elevator) {
    maxScore += 5;
    if (listing.elevator) score += 5;
  }

  // Area match
  if (prefs.areas.length > 0 && listing.area) {
    maxScore += 10;
    if (prefs.areas.some((a) => listing.area.includes(a) || listing.address.includes(a))) {
      score += 10;
    }
  }

  // Keyword match
  if (prefs.keywords.length > 0) {
    maxScore += 5;
    const text = `${listing.title} ${listing.description} ${listing.address}`.toLowerCase();
    const matched = prefs.keywords.filter((kw) =>
      text.includes(kw.toLowerCase()),
    );
    score += (matched.length / prefs.keywords.length) * 5;
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Compute a similarity score between a listing and example listings.
 * Uses feature overlap to determine similarity.
 */
export function similarityToExamples(
  listing: Listing,
  examples: ExampleListing[],
  allListings: Listing[],
): number {
  if (examples.length === 0) return 0;

  // Find example listings from our scraped data
  const exampleListings = examples
    .map((ex) => allListings.find((l) => l.url === ex.url))
    .filter(Boolean) as Listing[];

  if (exampleListings.length === 0) return 0;

  let totalSimilarity = 0;

  for (const example of exampleListings) {
    let sim = 0;

    // Price similarity (within 20% = high similarity)
    if (example.price > 0 && listing.price > 0) {
      const priceDiff = Math.abs(listing.price - example.price) / example.price;
      sim += Math.max(0, 1 - priceDiff) * 25;
    }

    // Room count match
    if (example.rooms > 0 && listing.rooms > 0) {
      const roomDiff = Math.abs(listing.rooms - example.rooms);
      sim += Math.max(0, 1 - roomDiff / 3) * 20;
    }

    // Sqm similarity
    if (example.sqm > 0 && listing.sqm > 0) {
      const sqmDiff = Math.abs(listing.sqm - example.sqm) / example.sqm;
      sim += Math.max(0, 1 - sqmDiff) * 15;
    }

    // Feature overlap
    if (example.balcony === listing.balcony) sim += 10;
    if (example.parking === listing.parking) sim += 10;
    if (example.mamad === listing.mamad) sim += 10;

    // Area match
    if (example.area && listing.area && example.area === listing.area) {
      sim += 10;
    }

    totalSimilarity += sim;
  }

  return Math.round(totalSimilarity / exampleListings.length);
}

/**
 * Filter and rank listings based on preferences and examples.
 */
export function rankListings(
  listings: Listing[],
  prefs: SearchPreferences,
  examples: ExampleListing[],
): Listing[] {
  return listings
    .map((listing) => {
      const prefScore = scoreListing(listing, prefs);
      const simScore = similarityToExamples(listing, examples, listings);
      // Weighted combination: 70% preferences, 30% similarity to examples
      const combined =
        examples.length > 0
          ? prefScore * 0.7 + simScore * 0.3
          : prefScore;
      return { ...listing, similarityScore: Math.round(combined) };
    })
    .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
}
