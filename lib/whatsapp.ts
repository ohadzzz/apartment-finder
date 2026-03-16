import { Listing } from "./types";

/**
 * Send WhatsApp messages via Twilio.
 * Requires:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (e.g., "whatsapp:+14155238886")
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.error("Twilio credentials not configured");
    return false;
  }

  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        From: from,
        To: toNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Twilio error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    return false;
  }
}

/**
 * Format listings into a WhatsApp-friendly message.
 */
export function formatListingsMessage(listings: Listing[]): string {
  if (listings.length === 0) {
    return "🏠 No new apartments found matching your criteria.";
  }

  const header = `🏠 *${listings.length} New Apartments Found!*\n\n`;

  const items = listings.slice(0, 10).map((l, i) => {
    const features = [];
    if (l.balcony) features.push("🌿 Balcony");
    if (l.parking) features.push("🅿️ Parking");
    if (l.mamad) features.push("🛡️ Mamad");
    if (l.elevator) features.push("🛗 Elevator");

    const score = l.similarityScore ? ` (${l.similarityScore}% match)` : "";

    return [
      `*${i + 1}. ${l.title || l.address}*${score}`,
      `💰 ₪${l.price.toLocaleString()}/month`,
      l.rooms ? `🛏️ ${l.rooms} rooms` : "",
      l.sqm ? `📐 ${l.sqm} sqm` : "",
      l.floor ? `🏢 Floor ${l.floor}` : "",
      l.area ? `📍 ${l.area}` : "",
      features.length ? features.join(" | ") : "",
      l.agentName ? `👤 ${l.agentName}` : "",
      `🔗 ${l.url}`,
      `📌 Source: ${l.source}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const footer =
    listings.length > 10
      ? `\n\n_...and ${listings.length - 10} more. Check the dashboard for full list._`
      : "";

  return header + items.join("\n\n---\n\n") + footer;
}

/**
 * Send listing notifications to all configured WhatsApp numbers.
 */
export async function notifyNewListings(
  listings: Listing[],
  whatsappNumbers: string[],
): Promise<{ sent: number; failed: number }> {
  if (listings.length === 0 || whatsappNumbers.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const message = formatListingsMessage(listings);
  let sent = 0;
  let failed = 0;

  for (const number of whatsappNumbers) {
    const success = await sendWhatsAppMessage(number, message);
    if (success) sent++;
    else failed++;
  }

  return { sent, failed };
}
