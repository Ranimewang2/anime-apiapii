/**
 * GET /api/v1/movies?page=1
 *
 * Browse all movies, paginated.
 * The site uses /movies/page/2/ for pagination.
 *
 * Params:
 *   page  (optional, default 1)
 *
 * Response:
 * {
 *   success: true,
 *   current_page: 1,
 *   total_pages: N,
 *   has_next: true,
 *   has_prev: false,
 *   movies: [ { title, poster, movieId, year, url } ]
 * }
 */

const { getHTML, extractSlug, ok, fail } = require("./_lib");
const { load } = require("cheerio");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(204).end();
  }

  const page = Math.max(1, parseInt(req.query.page || req.query.p) || 1);
  const path = page === 1 ? "/movies/" : `/movies/page/${page}/`;

  try {
    const html = await getHTML(path);
    const $ = load(html);

    const movies = [];

    $("li").each((_, li) => {
      const $li = $(li);
      const $a = $li.find("a[href*='/movies/']").first();
      if (!$a.length) return;

      const href = $a.attr("href") || "";
      const slug = extractSlug(href, "movies");
      if (!slug) return;

      const title = $li.find("h2").first().text().trim();
      const poster = $li.find("img").first().attr("src") || null;
      const year = $li.find("span, p").filter((_, el) =>
        /^\d{4}$/.test($(el).text().trim())
      ).first().text().trim() || null;

      if (!title) return;
      movies.push({ title, poster, year: year || null, movieId: slug, url: href });
    });

    // Pagination
    let totalPages = 1;
    $("a[href*='/movies/page/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const m = href.match(/\/page\/(\d+)\//);
      if (m) totalPages = Math.max(totalPages, parseInt(m[1]));
    });
    $("a").each((_, a) => {
      const text = $(a).text().trim();
      if (/^\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
    });

    return ok(res, {
      source: "watchanimeworld.net/movies",
      current_page: page,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      total_results: movies.length,
      movies,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
