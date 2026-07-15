/**
 * Shared utilities for watchanimeworld.net scraping.
 * Uses Node.js native fetch (available in Node 18+, which Vercel uses by default).
 */

const BASE = "https://watchanimeworld.net";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: BASE + "/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
};

/**
 * Fetch a page and return its HTML string.
 * Throws a descriptive error on failure.
 */
async function getHTML(path) {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Upstream returned HTTP ${res.status} for: ${url}`);
  }
  const text = await res.text();
  if (!text || text.length < 100) {
    throw new Error(`Empty response from: ${url}`);
  }
  return text;
}

/**
 * Extract slug from a URL like https://watchanimeworld.net/series/naruto/
 * Pass the full href and the segment name ("series", "movies", "episode")
 */
function extractSlug(href, segment) {
  if (!href) return null;
  // handle relative or absolute
  const path = href.replace(BASE, "").replace(/^\/|\/$/g, "");
  const parts = path.split("/");
  const idx = parts.indexOf(segment);
  if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  return null;
}

/**
 * Standard JSON success response
 */
function ok(res, data) {
  res.setHeader("Content-Type", "application/json; charset=UTF-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return res.status(200).json({ success: true, ...data });
}

/**
 * Standard JSON error response
 */
function fail(res, message, status = 500) {
  res.setHeader("Content-Type", "application/json; charset=UTF-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(status).json({ success: false, error: message });
}

module.exports = { BASE, getHTML, extractSlug, ok, fail };
