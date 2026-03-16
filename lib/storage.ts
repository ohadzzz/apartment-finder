import { promises as fs } from "fs";
import path from "path";
import { Listing, UserConfig, DEFAULT_CONFIG } from "./types";

// File-based storage that works on Vercel (using /tmp for serverless)
// For production, replace with a proper database (Vercel KV, Supabase, etc.)
const DATA_DIR = process.env.DATA_DIR || "/tmp/apartment-finder";

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function readJson<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDir();
  try {
    const data = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
  );
}

// --- User Config ---

export async function getConfig(): Promise<UserConfig> {
  return readJson("config.json", DEFAULT_CONFIG);
}

export async function saveConfig(config: UserConfig): Promise<void> {
  await writeJson("config.json", config);
}

// --- Listings ---

export async function getListings(): Promise<Listing[]> {
  return readJson("listings.json", []);
}

export async function saveListings(listings: Listing[]): Promise<void> {
  await writeJson("listings.json", listings);
}

export async function addListings(newListings: Listing[]): Promise<Listing[]> {
  const existing = await getListings();
  const existingIds = new Set(existing.map((l) => l.id));
  const unique = newListings.filter((l) => !existingIds.has(l.id));
  const updated = [...unique, ...existing].slice(0, 500); // keep latest 500
  await saveListings(updated);
  return unique; // return only new ones
}

// --- Seen listings (for dedup) ---

export async function getSeenIds(): Promise<Set<string>> {
  const ids = await readJson<string[]>("seen.json", []);
  return new Set(ids);
}

export async function markSeen(ids: string[]): Promise<void> {
  const existing = await readJson<string[]>("seen.json", []);
  const all = Array.from(new Set([...ids, ...existing])).slice(0, 2000);
  await writeJson("seen.json", all);
}

// --- Notification log ---

export async function getLastNotified(): Promise<string> {
  const config = await getConfig();
  return config.lastNotified || "";
}

export async function setLastNotified(timestamp: string): Promise<void> {
  const config = await getConfig();
  config.lastNotified = timestamp;
  await saveConfig(config);
}
