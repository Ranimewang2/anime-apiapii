/**
 * GET /api/v1/episode?id=naruto-1x1
 *
 * Get stream servers and nav info for an episode.
 * Scrapes /episode/{id}/
 *
 * REAL EPISODE URL FORMAT: /episode/{series-slug}-{season}x{episode}/
 * Examples:
 *   naruto-1x1, naruto-5x220, one-piece-1x1
 *
 * Params:
 *   id  (required) — episode slug, e.g. "naruto-1x1"
 *
 * Response:
 * {
 *   success: true,
 *   episode: {
 *     episodeId, title, label, seasonNumber, episodeNumber,
 *     seriesId, seriesTitle, poster, overview, url
 *   },
 *   servers: [ { name, url } ],
 *   prev: "naruto-1x0" | null,
 *   next: "naruto-1x2" | null,
 *   all_episodes: [ { episodeId, label, title, poster, url } ]
 * }
 */

const { getHTML, extractSlug, BASE, ok, fail } = require("./_lib");
const { load } = require("cheerio");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(204).end();
  }

  const id = (req.query.id || "").trim().toLowerCase();
  if (!id) return fail(res, "Missing required parameter: id", 400);

  try {
    const html = await getHTML(`/episode/${id}/`);
    const $ = load(html);

    // ── Parse season/episode numbers from the id (e.g. naruto-5x220)
    const epMatch = id.match(/-(\d+)x(\d+)$/);
    const seasonNumber = epMatch ? parseInt(epMatch[1]) : null;
    const episodeNumber = epMatch ? parseInt(epMatch[2]) : null;
    // Series slug = everything before "-Nx" (e.g. "naruto")
    const seriesId = epMatch ? id.replace(/-\d+x\d+$/, "") : null;

    // ── Title (episode title from h1 or page title)
    const pageTitle = $("title").first().text().trim();
    const h1 = $("h1").first().text().trim();
    const title = h1 || pageTitle || null;

    // ── Label (e.g. "5x220") from a span on the page
    const label = epMatch ? `${epMatch[1]}x${epMatch[2]}` : id;

    // ── Series title (usually in breadcrumb or a heading near nav)
    let seriesTitle = null;
    $("a[href*='/series/']").each((_, a) => {
      const t = $(a).text().trim();
      if (t && t.length > 2 && !seriesTitle) seriesTitle = t;
    });

    // ── Poster / thumbnail for this episode
    const poster =
      $("img[src*='img.watchanimeworld'], img[src*='tmdb.org']")
        .first().attr("src") || null;

    // ── Overview
    let overview = null;
    let maxLen = 0;
    $("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text.length > maxLen && text.length > 50) {
        maxLen = text.length;
        overview = text;
      }
    });

    // ── Stream servers (same logic as movie-detail)
    const servers = [];
    const seenUrls = new Set();

    $("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (
        href.startsWith("http") &&
        !href.includes("watchanimeworld.net") &&
        !href.includes("tmdb.org") &&
        !href.includes("t.me") &&
        !seenUrls.has(href) &&
        /play\.|stream\.|embed\.|video\.|watch\.|cdn\./.test(href)
      ) {
        const label = $(a).text().trim() || null;
        seenUrls.add(href);
        servers.push({ name: label || `Server ${servers.length + 1}`, url: href });
      }
    });

    $("iframe[src]").each((_, iframe) => {
      const src = $(iframe).attr("src") || "";
      if (src && !seenUrls.has(src)) {
        seenUrls.add(src);
        servers.push({ name: `Server ${servers.length + 1}`, url: src });
      }
    });

    const streamUrlRegex = /https?:\/\/(?:play\.|stream\.|embed\.|video\.)[^\s"'<>]+/g;
    const rawHtml = $.html();
    let m;
    while ((m = streamUrlRegex.exec(rawHtml)) !== null) {
      const url = m[0].replace(/['")\s]+$/, "");
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        servers.push({ name: `Server ${servers.length + 1}`, url });
      }
    }

    // ── Prev / Next episode navigation
    // The site shows Prev/Next buttons — look for episode links near nav arrows
    let prev = null, next = null;
    const epLinks = [];
    $("a[href*='/episode/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const slug = extractSlug(href, "episode");
      if (slug && slug !== id) epLinks.push({ slug, href, text: $(a).text().trim() });
    });

    // Detect prev/next from context (text "Prev", "Next", arrow characters, or episode number)
    epLinks.forEach(({ slug, text, href }) => {
      if (/prev|previous|←|«/i.test(text)) prev = slug;
      else if (/next|→|»/i.test(text)) next = slug;
    });

    // Fallback: compute from episode number
    if (!prev && episodeNumber && episodeNumber > 1 && seriesId) {
      prev = `${seriesId}-${seasonNumber}x${episodeNumber - 1}`;
    }
    if (!next && episodeNumber && seriesId) {
      next = `${seriesId}-${seasonNumber}x${episodeNumber + 1}`;
    }

    // ── All episodes visible on this page (same season list)
    const all_episodes = [];
    const seenEps = new Set();
    $("a[href*='/episode/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const slug = extractSlug(href, "episode");
      if (!slug || seenEps.has(slug)) return;
      seenEps.add(slug);

      const em = slug.match(/-(\d+)x(\d+)$/);
      const $parent = $(a).closest("li");
      all_episodes.push({
        episodeId: slug,
        label: em ? `${em[1]}x${em[2]}` : slug,
        title: $parent.find("h2").first().text().trim() || null,
        poster: $parent.find("img").first().attr("src") || null,
        url: href,
      });
    });

    return ok(res, {
      source: `watchanimeworld.net/episode/${id}`,
      episode: {
        episodeId: id,
        label,
        title,
        seasonNumber,
        episodeNumber,
        seriesId,
        seriesTitle,
        poster,
        overview,
        url: `${BASE}/episode/${id}/`,
      },
      servers,
      prev,
      next,
      all_episodes,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
