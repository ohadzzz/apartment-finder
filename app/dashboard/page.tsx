"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Listing {
  id: string;
  source: string;
  title: string;
  description: string;
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
  condition: string;
  images: string[];
  url: string;
  agentName?: string;
  agentPhone?: string;
  postedAt: string;
  similarityScore?: number;
}

interface Preferences {
  minRooms: number;
  maxRooms: number;
  minPrice: number;
  maxPrice: number;
  minSqm: number;
  maxSqm: number;
  areas: string[];
  balcony: boolean;
  parking: boolean;
  mamad: boolean;
  penthouse: boolean;
  condition: string[];
  elevator: boolean;
  petFriendly: boolean;
  keywords: string[];
}

interface Config {
  preferences: Preferences;
  examples: { url: string; notes: string }[];
  whatsappNumbers: string[];
  notifyInterval: number;
  isActive: boolean;
}

const TEL_AVIV_AREAS = [
  "תל אביב - כללי", "הצפון הישן", "הצפון החדש", "לב העיר",
  "פלורנטין", "נווה צדק", "יפו", "רמת אביב", "רמת אביב גימל",
  "נווה שרת", "אפקה", "בבלי", "כוכב הצפון", "נחלת בנימין",
  "רוטשילד", "שרונה", "כרם התימנים", "מונטיפיורי", "צהלון",
];

const FACEBOOK_GROUPS = [
  { name: "דירות להשכרה בתל אביב", url: "https://www.facebook.com/groups/164138180289498" },
  { name: "דירות להשכרה - ללא תיווך", url: "https://www.facebook.com/groups/1430498917188498" },
  { name: "Rent Tel Aviv", url: "https://www.facebook.com/groups/297877953564975" },
  { name: "Secret Tel Aviv", url: "https://www.facebook.com/groups/341754369178571" },
  { name: "Apartments in Tel Aviv", url: "https://www.facebook.com/groups/236929389691498" },
  { name: "הומלס תל אביב", url: "https://www.facebook.com/groups/homeless.telaviv" },
  { name: "Sublet and Apartments TLV", url: "https://www.facebook.com/groups/tlvrooms" },
];

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "listings" | "settings">("search");
  const [config, setConfig] = useState<Config | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Load config on mount
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => {
        if (r.status === 401) { router.push("/"); return null; }
        return r.json();
      })
      .then((data) => data && setConfig(data));

    fetch("/api/listings")
      .then((r) => r.json())
      .then((data) => data?.listings && setListings(data.listings))
      .catch(() => {});
  }, [router]);

  const updatePrefs = useCallback(
    (key: string, value: any) => {
      if (!config) return;
      setConfig({
        ...config,
        preferences: { ...config.preferences, [key]: value },
      });
    },
    [config],
  );

  async function savePreferences() {
    if (!config) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  }

  async function runSearch() {
    setSearching(true);
    setSearchResult(null);
    const res = await fetch("/api/search", { method: "POST" });
    const data = await res.json();
    setSearchResult(data);
    if (data?.listings) setListings(data.listings);
    setSearching(false);
  }

  async function sendNotification() {
    const res = await fetch("/api/notify", { method: "POST" });
    const data = await res.json();
    alert(data.message || "Notification sent!");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  const filteredListings =
    sourceFilter === "all"
      ? listings
      : listings.filter((l) => l.source === sourceFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Apartment Finder TLV
          </h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span>Active</span>
              <input
                type="checkbox"
                checked={config.isActive}
                onChange={(e) =>
                  setConfig({ ...config, isActive: e.target.checked })
                }
                className="w-5 h-5"
              />
            </label>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm w-fit">
          {(["search", "listings", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t === "search"
                ? "Search Parameters"
                : t === "listings"
                  ? `Listings (${listings.length})`
                  : "Settings"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* SEARCH TAB */}
        {tab === "search" && (
          <div className="space-y-6">
            {/* Price & Size */}
            <Section title="Price & Size">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <NumberInput label="Min Price (₪)" value={config.preferences.minPrice} onChange={(v) => updatePrefs("minPrice", v)} />
                <NumberInput label="Max Price (₪)" value={config.preferences.maxPrice} onChange={(v) => updatePrefs("maxPrice", v)} />
                <NumberInput label="Min Rooms" value={config.preferences.minRooms} onChange={(v) => updatePrefs("minRooms", v)} step={0.5} />
                <NumberInput label="Max Rooms" value={config.preferences.maxRooms} onChange={(v) => updatePrefs("maxRooms", v)} step={0.5} />
                <NumberInput label="Min Sqm" value={config.preferences.minSqm} onChange={(v) => updatePrefs("minSqm", v)} />
                <NumberInput label="Max Sqm" value={config.preferences.maxSqm} onChange={(v) => updatePrefs("maxSqm", v)} />
              </div>
            </Section>

            {/* Features */}
            <Section title="Required Features">
              <div className="flex flex-wrap gap-4">
                <Toggle label="Balcony / מרפסת" checked={config.preferences.balcony} onChange={(v) => updatePrefs("balcony", v)} />
                <Toggle label="Parking / חנייה" checked={config.preferences.parking} onChange={(v) => updatePrefs("parking", v)} />
                <Toggle label="Mamad / ממ״ד" checked={config.preferences.mamad} onChange={(v) => updatePrefs("mamad", v)} />
                <Toggle label="Elevator / מעלית" checked={config.preferences.elevator} onChange={(v) => updatePrefs("elevator", v)} />
                <Toggle label="Penthouse / פנטהאוז" checked={config.preferences.penthouse} onChange={(v) => updatePrefs("penthouse", v)} />
                <Toggle label="Pet Friendly" checked={config.preferences.petFriendly} onChange={(v) => updatePrefs("petFriendly", v)} />
              </div>
            </Section>

            {/* Condition */}
            <Section title="Condition">
              <div className="flex flex-wrap gap-3">
                {["any", "new", "like-new", "renovated"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      const conds = config.preferences.condition.includes(c)
                        ? config.preferences.condition.filter((x) => x !== c)
                        : [...config.preferences.condition, c];
                      updatePrefs("condition", conds.length ? conds : ["any"]);
                    }}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      config.preferences.condition.includes(c)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {c === "any" ? "Any" : c === "new" ? "New / חדש" : c === "like-new" ? "Like New / כחדש" : "Renovated / משופץ"}
                  </button>
                ))}
              </div>
            </Section>

            {/* Areas */}
            <Section title="Areas in Tel Aviv">
              <div className="flex flex-wrap gap-2">
                {TEL_AVIV_AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => {
                      const areas = config.preferences.areas.includes(area)
                        ? config.preferences.areas.filter((a) => a !== area)
                        : [...config.preferences.areas, area];
                      updatePrefs("areas", areas);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      config.preferences.areas.includes(area)
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </Section>

            {/* Keywords */}
            <Section title="Keywords">
              <input
                type="text"
                value={config.preferences.keywords.join(", ")}
                onChange={(e) =>
                  updatePrefs(
                    "keywords",
                    e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                  )
                }
                placeholder="e.g., garden, quiet, renovated, sea view..."
                className="w-full px-4 py-2 border rounded-lg"
              />
            </Section>

            {/* Example Listings */}
            <Section title="Example Listings You Like">
              <p className="text-sm text-gray-500 mb-3">
                Paste URLs of listings you like. The system will find similar apartments.
              </p>
              {config.examples.map((ex, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={ex.url}
                    onChange={(e) => {
                      const examples = [...config.examples];
                      examples[i] = { ...examples[i], url: e.target.value };
                      setConfig({ ...config, examples });
                    }}
                    placeholder="https://www.yad2.co.il/item/..."
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={ex.notes}
                    onChange={(e) => {
                      const examples = [...config.examples];
                      examples[i] = { ...examples[i], notes: e.target.value };
                      setConfig({ ...config, examples });
                    }}
                    placeholder="Why you like it..."
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <button
                    onClick={() => {
                      const examples = config.examples.filter((_, j) => j !== i);
                      setConfig({ ...config, examples });
                    }}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    examples: [...config.examples, { url: "", notes: "" }],
                  })
                }
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add example listing
              </button>
            </Section>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={async () => { await savePreferences(); await runSearch(); }}
                disabled={searching}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {searching ? "Searching..." : "Save & Search Now"}
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>

            {searchResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-800">
                  Found {searchResult.newCount} new listings!
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Yad2: {searchResult.sources?.yad2 || 0} | Madlan:{" "}
                  {searchResult.sources?.madlan || 0} | Facebook:{" "}
                  {searchResult.sources?.facebook || 0} | Agents:{" "}
                  {searchResult.sources?.agents || 0}
                </p>
              </div>
            )}

            {/* Facebook Groups */}
            <Section title="Facebook Groups (Manual Check)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {FACEBOOK_GROUPS.map((g) => (
                  <a
                    key={g.url}
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-blue-50 transition text-sm"
                  >
                    <span className="text-blue-600">FB</span>
                    <span>{g.name}</span>
                    <span className="text-gray-400 mr-auto">&larr;</span>
                  </a>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* LISTINGS TAB */}
        {tab === "listings" && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm">
                {["all", "yad2", "madlan", "facebook", "agent"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    className={`px-4 py-1.5 rounded-md text-sm ${
                      sourceFilter === s
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {s === "all" ? `All (${listings.length})` : s}
                  </button>
                ))}
              </div>
              <button
                onClick={runSearch}
                disabled={searching}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? "..." : "Refresh"}
              </button>
              <button
                onClick={sendNotification}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Send to WhatsApp
              </button>
            </div>

            {filteredListings.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-xl mb-2">No listings yet</p>
                <p>Run a search to find apartments</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <Section title="WhatsApp Notifications">
              <p className="text-sm text-gray-500 mb-3">
                Add phone numbers to receive WhatsApp notifications (with country code, e.g., +972501234567)
              </p>
              {config.whatsappNumbers.map((num, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="tel"
                    value={num}
                    onChange={(e) => {
                      const numbers = [...config.whatsappNumbers];
                      numbers[i] = e.target.value;
                      setConfig({ ...config, whatsappNumbers: numbers });
                    }}
                    placeholder="+972501234567"
                    className="flex-1 px-3 py-2 border rounded-lg"
                    dir="ltr"
                  />
                  <button
                    onClick={() => {
                      const numbers = config.whatsappNumbers.filter((_, j) => j !== i);
                      setConfig({ ...config, whatsappNumbers: numbers });
                    }}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    whatsappNumbers: [...config.whatsappNumbers, ""],
                  })
                }
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add phone number
              </button>
            </Section>

            <Section title="Notification Interval">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={config.notifyInterval}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      notifyInterval: parseInt(e.target.value),
                    })
                  }
                  className="flex-1"
                />
                <span className="text-lg font-semibold w-24 text-center">
                  Every {config.notifyInterval}h
                </span>
              </div>
            </Section>

            <Section title="Real Estate Agents (Tel Aviv)">
              <div className="space-y-2">
                {[
                  { name: "אנגלו סכסון", phone: "03-5468200" },
                  { name: "רימקס - RE/MAX", phone: "03-5275757" },
                  { name: "הומלנד", phone: "03-5222111" },
                  { name: "ארזים נכסים", phone: "03-5441144" },
                  { name: "קולדוול בנקר", phone: "03-5466464" },
                  { name: "Century 21", phone: "03-7444421" },
                  { name: "לוי נדל״ן", phone: "03-5162222" },
                ].map((agent) => (
                  <div
                    key={agent.name}
                    className="flex items-center justify-between px-4 py-2 bg-white border rounded-lg"
                  >
                    <span className="font-medium">{agent.name}</span>
                    <a
                      href={`tel:${agent.phone}`}
                      className="text-blue-600 hover:underline"
                      dir="ltr"
                    >
                      {agent.phone}
                    </a>
                  </div>
                ))}
              </div>
            </Section>

            <button
              onClick={savePreferences}
              disabled={saving}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        className="w-full px-3 py-2 border rounded-lg"
        dir="ltr"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`px-4 py-2 rounded-full text-sm border transition ${
        checked
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
      }`}
    >
      {label}
    </button>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const sourceColors: Record<string, string> = {
    yad2: "bg-orange-100 text-orange-700",
    madlan: "bg-purple-100 text-purple-700",
    facebook: "bg-blue-100 text-blue-700",
    agent: "bg-green-100 text-green-700",
  };

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl shadow-sm border hover:shadow-md transition overflow-hidden"
    >
      {listing.images.length > 0 && (
        <div className="h-48 bg-gray-200 overflow-hidden">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${sourceColors[listing.source] || "bg-gray-100"}`}
          >
            {listing.source}
          </span>
          {listing.similarityScore !== undefined && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                listing.similarityScore >= 70
                  ? "bg-green-100 text-green-700"
                  : listing.similarityScore >= 40
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {listing.similarityScore}% match
            </span>
          )}
        </div>

        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">
          {listing.title || listing.address || "Apartment"}
        </h3>

        {listing.address && listing.address !== listing.title && (
          <p className="text-sm text-gray-500 mb-2">{listing.address}</p>
        )}

        <p className="text-2xl font-bold text-blue-600 mb-2" dir="ltr">
          {listing.price > 0 ? `₪${listing.price.toLocaleString()}/mo` : "Price N/A"}
        </p>

        <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
          {listing.rooms > 0 && <span>{listing.rooms} rooms</span>}
          {listing.sqm > 0 && <span>{listing.sqm} sqm</span>}
          {listing.floor > 0 && <span>Floor {listing.floor}</span>}
          {listing.area && <span>{listing.area}</span>}
        </div>

        <div className="flex flex-wrap gap-1">
          {listing.balcony && <Badge text="Balcony" />}
          {listing.parking && <Badge text="Parking" />}
          {listing.mamad && <Badge text="Mamad" />}
          {listing.elevator && <Badge text="Elevator" />}
        </div>

        {listing.agentName && (
          <p className="text-xs text-gray-400 mt-2">
            Agent: {listing.agentName}
            {listing.agentPhone && ` | ${listing.agentPhone}`}
          </p>
        )}
      </div>
    </a>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
      {text}
    </span>
  );
}
