/**
 * GET /api/v1/search?query=naruto&page=1
 *
 * Search the site.
 * The site uses /?s=query for search.
 *
 * Params:
 *   query  (required)
 *   page   (optional, default 1)
 *
 * Response:
 * {
 *   success: true,
 *   query: "naruto",
 *   current_page: 1,
 *   total_pages: N,
 *   has_next: bool,
 *   results: [ { title, poster, type, seriesId|movieId, year, url } ]
 * }
 */

const { getHTML, extractSlug, ok, fail } = require("./_lib");
const { load } = require("cheerio");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(204).end();
  }

  const query = (req.query.query || req.query.q || "").trim();
  const page  = Math.max(1, parseInt(req.query.page || req.query.p) || 1);

  if (!query) {
    return fail(res, "Missing required parameter: query", 400);
  }

  // Site search URL format: /?s=naruto or /?s=naruto&paged=2
  const path = page === 1
    ? `/?s=${encodeURIComponent(query)}`
    : `/?s=${encodeURIComponent(query)}&paged=${page}`;

  try {
    const html = await getHTML(path);
    const $ = load(html);

    const results = [];
    const seen = new Set();

    // Search results appear as <li> or <article> blocks with links to /series/ or /movies/
    $("li, article").each((_, el) => {
      const $el = $(el);

      // Try series first
      const $seriesLink = $el.find("a[href*='/series/']").first();
      const $movieLink  = $el.find("a[href*='/movies/']").first();
      const $link = $seriesLink.length ? $seriesLink : $movieLink;
      if (!$link.length) return;

      const href = $link.attr("href") || "";
      const isMovie = href.includes("/movies/");
      const slug = isMovie
        ? extractSlug(href, "movies")
        : extractSlug(href, "series");
      if (!slug || seen.has(slug)) return;

      const title = $el.find("h2, h3").first().text().trim();
      const poster = $el.find("img").first().attr("src") || null;
      const year = $el.find("span, p").filter((_, e) =>
        /^\d{4}$/.test($(e).text().trim())
      ).first().text().trim() || null;

      if (!title) return;
      seen.add(slug);

      const item = {
        title,
        poster,
        year: year || null,
        type: isMovie ? "movie" : "series",
        url: href,
      };
      if (isMovie) item.movieId = slug;
      else item.seriesId = slug;

      results.push(item);
    });

    // Pagination
    let totalPages = 1;
    $("a[href*='paged=']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const m = href.match(/paged=(\d+)/);
      if (m) totalPages = Math.max(totalPages, parseInt(m[1]));
    });
    $("a").each((_, a) => {
      const text = $(a).text().trim();
      if (/^\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
    });

    return ok(res, {
      source: "watchanimeworld.net/search",
      query,
      current_page: page,
      total_pages: totalPages,
      has_next: page < totalPages,
      total_results: results.length,
      results,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
