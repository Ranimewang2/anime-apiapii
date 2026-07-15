/**
 * GET /api/v1/movie-detail?id=demon-slayer-kimetsu-no-yaiba-infinity-castle
 *
 * Get full details + stream servers for a movie.
 * Scrapes /movies/{id}/ — confirmed real structure from live site.
 *
 * REAL SITE STRUCTURE (verified):
 * - Title: <h1>
 * - Poster: <img src="tmdb.org/...w185...">
 * - Overview: longest <p> on page
 * - Genres: <a href="/category/genre/...">
 * - Languages: <a href="/category/language/...">
 * - Duration: text matching "\d+h \d+m" or "\d+ min"
 * - Year: 4-digit standalone text
 * - Network: <a href="/category/network/..."><img>
 * - Stream servers: <a href="#options-N"> or iframe/script containing stream URL
 *   Real example found: https://play.zephyrflick.top/video/948750a01b42decb760277c873238254
 *   Also: "Server 1 Play", "Server 2 Abyss" tabs
 *
 * Params:
 *   id  (required) — movie slug
 *
 * Response:
 * {
 *   success: true,
 *   movie: { movieId, title, poster, backdrop, overview, year, duration, genres, languages, network },
 *   servers: [ { name, url } ]
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
    const html = await getHTML(`/movies/${id}/`);
    const $ = load(html);

    // ── Title
    const title = $("h1").first().text().trim() || null;

    // ── Poster
    const poster =
      $("img[src*='tmdb.org'], img[src*='watchanimeworld.net/files']")
        .first().attr("src") || null;

    // ── Backdrop
    const backdropStyle = $("[style*='background']").first().attr("style") || "";
    const bdMatch = backdropStyle.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/);
    const backdrop = bdMatch ? bdMatch[1] : null;

    // ── Overview (longest paragraph, excluding nav/footer)
    let overview = null;
    let maxLen = 0;
    $("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text.length > maxLen && text.length > 50) {
        maxLen = text.length;
        overview = text;
      }
    });

    // ── Duration (e.g. "2h 35m" or "90 min")
    let duration = null;
    $("p, span, li").each((_, el) => {
      const t = $(el).text().trim();
      if (/^\d+h\s*\d*m?$/.test(t) || /^\d+\s*min$/.test(t)) {
        duration = t;
      }
    });

    // ── Year
    let year = null;
    $("p, span").each((_, el) => {
      const t = $(el).text().trim();
      if (/^\d{4}$/.test(t)) { year = t; return false; }
    });

    // ── Genres
    const genres = [];
    $("a[href*='/category/genre/']").each((_, a) => {
      const g = $(a).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    // ── Languages
    const languages = [];
    $("a[href*='/category/language/']").each((_, a) => {
      const l = $(a).text().trim();
      if (l && !languages.includes(l)) languages.push(l);
    });

    // ── Network
    const networkImg = $("a[href*='/category/network/'] img").first();
    const network = networkImg.length
      ? (networkImg.attr("alt") || networkImg.attr("title") || null)
      : null;

    // ── Stream servers
    // The site shows server buttons like "Server 1 Play", "Server 2 Abyss"
    // and the actual stream URLs appear as plain text links or in iframes
    const servers = [];
    const seenUrls = new Set();

    // Direct stream URLs in plain <a> or text (e.g. play.zephyrflick.top)
    $("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (
        href.startsWith("http") &&
        !href.includes("watchanimeworld.net") &&
        !href.includes("tmdb.org") &&
        !href.includes("t.me") &&
        !href.startsWith("#") &&
        !seenUrls.has(href)
      ) {
        const label = $(a).text().trim() || null;
        // Filter to likely stream URLs
        if (/play\.|stream\.|embed\.|video\.|watch\.|cdn\./.test(href)) {
          seenUrls.add(href);
          servers.push({ name: label || `Server ${servers.length + 1}`, url: href });
        }
      }
    });

    // iframes
    $("iframe[src]").each((_, iframe) => {
      const src = $(iframe).attr("src") || "";
      if (src && !seenUrls.has(src)) {
        seenUrls.add(src);
        servers.push({ name: `Server ${servers.length + 1}`, url: src });
      }
    });

    // Stream URLs embedded in page text/script (e.g. "https://play.zephyrflick.top/...")
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

    return ok(res, {
      source: `watchanimeworld.net/movies/${id}`,
      movie: {
        movieId: id,
        title,
        poster,
        backdrop,
        overview,
        year,
        duration,
        genres,
        languages,
        network,
      },
      servers,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
