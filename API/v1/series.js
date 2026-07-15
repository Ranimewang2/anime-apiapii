/**
 * GET /api/v1/series?page=1
 *
 * Browse all series, paginated (10 per page).
 * The site uses /series/page/2/ for pagination.
 *
 * Params:
 *   page  (optional, default 1)
 *
 * Response:
 * {
 *   success: true,
 *   current_page: 1,
 *   total_pages: 38,
 *   has_next: true,
 *   has_prev: false,
 *   series: [ { title, poster, seriesId, year, url } ]
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
  const path = page === 1 ? "/series/" : `/series/page/${page}/`;

  try {
    const html = await getHTML(path);
    const $ = load(html);

    const series = [];

    // Real structure: <li> with <h2> title, <img>, and <a href="/series/slug/">
    // Each card is a <li> containing a "View Serie" link and an h2 heading
    $("li").each((_, li) => {
      const $li = $(li);
      const $a = $li.find("a[href*='/series/']").first();
      if (!$a.length) return;

      const href = $a.attr("href") || "";
      const slug = extractSlug(href, "series");
      if (!slug) return;

      const title = $li.find("h2").first().text().trim();
      const poster = $li.find("img").first().attr("src") || null;
      const year = $li.find("span, p").filter((_, el) =>
        /^\d{4}$/.test($(el).text().trim())
      ).first().text().trim() || null;

      if (!title) return;

      series.push({ title, poster, year: year || null, seriesId: slug, url: href });
    });

    // Pagination — site uses: [1] [2] [3] [...] [38] NEXT
    let totalPages = 1;
    $("a[href*='/series/page/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const m = href.match(/\/page\/(\d+)\//);
      if (m) totalPages = Math.max(totalPages, parseInt(m[1]));
    });
    // Also check the last numbered pagination link
    $("a").each((_, a) => {
      const text = $(a).text().trim();
      if (/^\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
    });

    return ok(res, {
      source: "watchanimeworld.net/series",
      current_page: page,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      total_results: series.length,
      series,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
