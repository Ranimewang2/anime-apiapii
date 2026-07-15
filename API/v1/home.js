/**
 * GET /api/v1/home
 *
 * Returns latest series, latest movies, and newest arrivals from the homepage.
 * No parameters required.
 *
 * Response shape:
 * {
 *   success: true,
 *   newest_drops: [ { title, poster, seriesId, badge } ],
 *   new_anime_arrivals: [ { title, poster, seriesId } ],
 *   latest_movies: [ { title, poster, movieId } ],
 *   most_watched_series: [ { title, poster, seriesId } ],
 *   most_watched_movies: [ { title, poster, movieId } ]
 * }
 */

const { getHTML, extractSlug, ok, fail } = require("./_lib");
const { load } = require("cheerio");

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(204).end();
  }

  try {
    const html = await getHTML("/");
    const $ = load(html);

    // ── Newest Drops (the main featured rail, has badge like "Season 1 EP:5-6")
    const newest_drops = [];
    // Each item is a <li> containing an <h2> title and an <a> link
    // The badge text (e.g. "Season 1 EP:5-6") appears in a <p> or sibling text node
    $("section, div, ul").find("li").each((_, li) => {
      const $li = $(li);
      const $link = $li.find("a[href*='/series/'], a[href*='/movies/']").first();
      if (!$link.length) return;

      const href = $link.attr("href") || "";
      const title = $li.find("h2, h3").first().text().trim();
      const poster = $li.find("img").first().attr("src") || null;
      if (!title || !href.includes("watchanimeworld.net")) return;

      const isMovie = href.includes("/movies/");
      const slug = isMovie
        ? extractSlug(href, "movies")
        : extractSlug(href, "series");
      if (!slug) return;

      newest_drops.push({
        title,
        poster,
        type: isMovie ? "movie" : "series",
        ...(isMovie ? { movieId: slug } : { seriesId: slug }),
        url: href,
      });
    });

    // ── New Anime Arrivals — the site uses "View Serie" text links with h2 titles
    // These appear as <li> blocks with an <h2> and <a href="/series/...">
    const new_arrivals = [];
    const seen_arrivals = new Set();
    $("a[href*='/series/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const slug = extractSlug(href, "series");
      if (!slug || seen_arrivals.has(slug)) return;

      // The title is usually in the closest h2 or the parent container h2
      const $parent = $(a).closest("li, div, article");
      const title = $parent.find("h2").first().text().trim() || $(a).text().trim();
      const poster = $parent.find("img").first().attr("src") || null;

      if (!title || title === "View Serie") return;
      seen_arrivals.add(slug);
      new_arrivals.push({ title, poster, seriesId: slug, url: href });
    });

    // ── Latest Movies
    const latest_movies = [];
    const seen_movies = new Set();
    $("a[href*='/movies/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const slug = extractSlug(href, "movies");
      if (!slug || seen_movies.has(slug)) return;

      const $parent = $(a).closest("li, div, article");
      const title = $parent.find("h2").first().text().trim() || $(a).text().trim();
      const poster = $parent.find("img").first().attr("src") || null;

      if (!title || title === "View Movie") return;
      seen_movies.add(slug);
      latest_movies.push({ title, poster, movieId: slug, url: href });
    });

    return ok(res, {
      source: "watchanimeworld.net",
      latest_series: new_arrivals.slice(0, 30),
      latest_movies: latest_movies.slice(0, 30),
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
