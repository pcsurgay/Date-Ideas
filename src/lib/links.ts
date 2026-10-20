// Pure helpers for recognising and describing pasted links.
// No framework imports, so they can be unit-tested with `npm test`.

export type Source =
  | "google_maps"
  | "apple_maps"
  | "tripadvisor"
  | "booking"
  | "airbnb"
  | "getyourguide"
  | "other";

export const SOURCE_LABEL: Record<Source, string> = {
  google_maps: "Google Maps",
  apple_maps: "Apple Maps",
  tripadvisor: "TripAdvisor",
  booking: "Booking.com",
  airbnb: "Airbnb",
  getyourguide: "GetYourGuide",
  other: "Link",
};

// Hosts the server is allowed to fetch for previews. This is an explicit list
// (not a pattern like "google.*") on purpose: the server fetches whatever URL a
// user pastes, so anything unknown must never be requested.
const COUNTRY_TLDS = ["com", "ch", "de", "fr", "it", "at", "es", "co.uk"];

function withTlds(base: string): string[] {
  return COUNTRY_TLDS.map((tld) => `${base}.${tld}`);
}

const ALLOWED_BASE_HOSTS: string[] = [
  ...withTlds("google"),
  ...withTlds("tripadvisor"),
  ...withTlds("airbnb"),
  "goo.gl",
  "apple.com",
  "booking.com",
  "getyourguide.com",
];

function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_BASE_HOSTS.some((base) => hostMatches(h, base));
}

/** True when the server may fetch this URL (also used for every redirect hop). */
export function isFetchableUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  return isAllowedHost(u.hostname);
}

export function detectSource(raw: string): Source {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "other";
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if (host === "maps.app.goo.gl") return "google_maps";
  if (host === "goo.gl" && path.startsWith("/maps")) return "google_maps";
  if (
    withTlds("google").some((base) => hostMatches(host, base)) &&
    (host.startsWith("maps.") || path.startsWith("/maps"))
  ) {
    return "google_maps";
  }
  if (hostMatches(host, "apple.com") && host.startsWith("maps.")) {
    return "apple_maps";
  }
  if (withTlds("tripadvisor").some((base) => hostMatches(host, base))) {
    return "tripadvisor";
  }
  if (hostMatches(host, "booking.com")) return "booking";
  if (withTlds("airbnb").some((base) => hostMatches(host, base))) {
    return "airbnb";
  }
  if (hostMatches(host, "getyourguide.com")) return "getyourguide";
  return "other";
}

/** Pulls the first http(s) URL out of pasted text (share sheets add a name). */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[).,;!?]+$/, "");
}

function clean(s: string): string {
  return s.replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Best-effort place name taken from the URL itself, without any request. */
export function parsePlaceName(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const source = detectSource(raw);

  if (source === "google_maps") {
    const m = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (m) return clean(safeDecode(m[1])) || null;
    const q = u.searchParams.get("q") ?? u.searchParams.get("query");
    if (q && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(q.trim())) {
      return clean(q) || null;
    }
    return null;
  }

  if (source === "apple_maps") {
    const name =
      u.searchParams.get("name") ??
      u.searchParams.get("q") ??
      u.searchParams.get("address");
    return name ? clean(name) || null : null;
  }

  if (source === "tripadvisor") {
    const m = u.pathname.match(/-Reviews?-(.+?)(?:\.html)?$/i);
    if (!m) return null;
    const parts = safeDecode(m[1]).split("-").filter(Boolean);
    const words = parts.length > 1 ? parts.slice(0, -1) : parts;
    return clean(words.join(" ").replace(/_/g, " ")) || null;
  }

  return null;
}

/** Only allow redirecting to a path inside this app after login. */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

/** Page titles that carry no information about the place. */
export function isGenericTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  return (
    t === "" ||
    t === "google maps" ||
    t === "apple maps" ||
    t === "tripadvisor" ||
    t === "before you continue to google"
  );
}
