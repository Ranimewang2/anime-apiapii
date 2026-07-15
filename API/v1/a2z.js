/**
 * GET /api/v1/a2z?letter=N&page=1
 *
 * Browse titles by first letter.
 * Real URL: /letter/N  (no pagination found in live test)
 *
 * Params:
 *   letter  (required) — single letter A-Z or "0-9" for numbers
 *   page    (optional, default 1)
 *
 * Response:
 * {
 *   success: true,
 *   letter: "N",
 *   current_page: 1,
 *   total_pages: N,
 *   results: [ { title, poster, type, seriesId|movieId, url } ]
 * }
 */

const { getHTML, extractSlug, ok, fail } = require("./_lib");
const { load } = require("cheerio");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(204).end();
  }

  let letter = (req.query.letter || req.query.l || "").trim();
  const page = Math.max(1, parseInt(req.query.page || req.query.p) || 1);

  if (!letter) return fail(res, "Missing required parameter: letter", 400);

  // Normalize: numbers → "0-9"
  if (/^\d+$/.test(letter)) letter = "0-9";

  const path = page === 1
    ? `/letter/${encodeURIComponent(letter)}/`
    : `/letter/${encodeURIComponent(letter)}/page/${page}/`;

  try {
    const html = await getHTML(path);
    const $ = load(html);

    const results = [];
    const seen = new Set();

    $("li").each((_, li) => {
      const $li = $(li);
      const $seriesLink = $li.find("a[href*='/series/']").first();
      const $movieLink  = $li.find("a[href*='/movies/']").first();
      const $link = $seriesLink.length ? $seriesLink : $movieLink;
      if (!$link.length) return;

      const href = $link.attr("href") || "";
      const isMovie = href.includes("/movies/");
      const slug = isMovie
        ? extractSlug(href, "movies")
        : extractSlug(href, "series");
      if (!slug || seen.has(slug)) return;

      const title = $li.find("h2").first().text().trim();
      const poster = $li.find("img").first().attr("src") || null;
      const year = $li.find("span, p").filter((_, el) =>
        /^\d{4}$/.test($(el).text().trim())
      ).first().text().trim() || null;

      if (!title) return;
      seen.add(slug);

      const item = { title, poster, year: year || null, type: isMovie ? "movie" : "series", url: href };
      if (isMovie) item.movieId = slug;
      else item.seriesId = slug;
      results.push(item);
    });

    // Pagination
    let totalPages = 1;
    $(`a[href*='/letter/${letter}/page/']`).each((_, a) => {
      const href = $(a).attr("href") || "";
      const m = href.match(/\/page\/(\d+)\//);
      if (m) totalPages = Math.max(totalPages, parseInt(m[1]));
    });
    $("a").each((_, a) => {
      const text = $(a).text().trim();
      if (/^\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
    });

    return ok(res, {
      source: `watchanimeworld.net/letter/${letter}`,
      letter,
      current_page: page,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      total_results: results.length,
      results,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
