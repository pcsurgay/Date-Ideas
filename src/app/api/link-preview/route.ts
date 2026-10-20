import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  detectSource,
  extractFirstUrl,
  isFetchableUrl,
  isGenericTitle,
  parsePlaceName,
} from "@/lib/links";
import type { LinkPreview } from "@/lib/types";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 6000;

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Follows redirects by hand so every hop is checked against the host
// allowlist. Short links (maps.app.goo.gl) are how most Google Maps shares
// look, and they only reveal the place after redirecting.
async function resolve(startUrl: string): Promise<{
  finalUrl: string;
  html: string | null;
}> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);

    // In the EU Google may redirect to a consent page; the real target is in
    // its `continue` parameter.
    if (parsed.hostname.startsWith("consent.")) {
      const next = parsed.searchParams.get("continue");
      if (next && isFetchableUrl(next)) {
        current = next;
        continue;
      }
      return { finalUrl: current, html: null };
    }

    if (!isFetchableUrl(current)) return { finalUrl: current, html: null };

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; IdeaBoardBot/0.1; link preview)",
        "accept-language": "en",
        accept: "text/html",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { finalUrl: current, html: null };
      current = new URL(location, current).toString();
      continue;
    }

    if (!res.ok) return { finalUrl: current, html: null };
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) {
      return { finalUrl: current, html: null };
    }
    return { finalUrl: current, html: await readLimited(res) };
  }
  return { finalUrl: current, html: null };
}

function readMeta(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr("content") ??
    $(`meta[name="${name}"]`).attr("content") ??
    null;

  const title = (meta("og:title") ?? $("title").first().text() ?? "").trim();

  let image: string | null = null;
  const rawImage = meta("og:image") ?? meta("twitter:image");
  if (rawImage) {
    try {
      const abs = new URL(rawImage, baseUrl);
      if (abs.protocol === "https:") image = abs.toString();
    } catch {
      // ignore a malformed image URL
    }
  }

  return { title: isGenericTitle(title) ? null : title.slice(0, 200), image };
}

export async function POST(request: Request) {
  // The proxy already blocks signed-out requests; check again so this route is
  // never an open fetch-proxy if the proxy matcher changes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let input: unknown;
  try {
    input = (await request.json())?.url;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof input !== "string" || input.length > 4000) {
    return NextResponse.json({ error: "Missing link" }, { status: 400 });
  }

  const url = extractFirstUrl(input);
  if (!url || url.length > 2048) {
    return NextResponse.json(
      { error: "That doesn't look like a link" },
      { status: 400 },
    );
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a link" },
      { status: 400 },
    );
  }

  const preview: LinkPreview = {
    url,
    title: null,
    image: null,
    source: detectSource(url),
    placeName: parsePlaceName(url),
  };

  // Unknown sites are saved as plain links and never fetched by the server.
  if (!isFetchableUrl(url)) return NextResponse.json(preview);

  try {
    const { finalUrl, html } = await resolve(url);
    if (isFetchableUrl(finalUrl)) {
      if (preview.source === "other") preview.source = detectSource(finalUrl);
      preview.placeName = parsePlaceName(finalUrl) ?? preview.placeName;
    }
    if (html) {
      const meta = readMeta(html, finalUrl);
      preview.title = meta.title;
      preview.image = meta.image;
    }
  } catch {
    // Timeouts and network errors: fall back to what the URL itself tells us.
  }

  return NextResponse.json(preview);
}
