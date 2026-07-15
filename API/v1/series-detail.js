/**
 * GET /api/v1/series-detail?id=naruto
 *
 * Get full details for a series including all seasons and their episode lists.
 * Scrapes /series/{id}/ — confirmed real structure from live site inspection.
 *
 * Params:
 *   id  (required) — series slug, e.g. "naruto", "one-piece"
 *
 * Response:
 * {
 *   success: true,
 *   series: {
 *     seriesId, title, poster, backdrop, overview,
 *     year, duration, genres, languages, network,
 *     totalSeasons, totalEpisodes
 *   },
 *   seasons: [
 *     {
 *       seasonNumber: 1,
 *       label: "Season 1",
 *       episodes: [ { episodeId, label, title, poster, episodeNumber, url } ]
 *     }
 *   ]
 * }
 *
 * REAL SITE STRUCTURE (verified from live HTML):
 * - Title: <h1> text
 * - Meta line: "[ 5 Seasons || 220 Episodes ]"
 * - Season tabs: <li> with text "Season 1", "Season 2" etc (javascript:void(0) links)
 * - Episodes: <li> blocks containing <a href="/episode/naruto-5x220/"> links
 *   with label "5x220", h2 title, and img poster
 * - Episode format: /episode/{seriesSlug}-{season}x{episode}/
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
    const html = await getHTML(`/series/${id}/`);
    const $ = load(html);

    // ── Title
    const title = $("h1").first().text().trim() || null;

    // ── Poster (w185 thumbnail shown on page)
    const poster =
      $("img[src*='tmdb.org'], img[src*='watchanimeworld.net/files']")
        .first().attr("src") || null;

    // ── Backdrop (bg image set in inline style or data attribute)
    const backdropStyle = $("[style*='background']").first().attr("style") || "";
    const backdropMatch = backdropStyle.match(/url\(['"]?(https?[^'")\s]+)['"]?\)/);
    const backdrop = backdropMatch ? backdropMatch[1] : null;

    // ── Meta line: "[ 5 Seasons || 220 Episodes ]"
    let totalSeasons = null, totalEpisodes = null;
    const metaText = $("p, span, div").filter((_, el) => {
      const t = $(el).text();
      return t.includes("Season") && t.includes("Episode");
    }).first().text().trim();
    if (metaText) {
      const sm = metaText.match(/(\d+)\s+Season/i);
      const em = metaText.match(/(\d+)\s+Episode/i);
      if (sm) totalSeasons = parseInt(sm[1]);
      if (em) totalEpisodes = parseInt(em[1]);
    }

    // ── Overview
    const overview = $("p").filter((_, el) => {
      const t = $(el).text().trim();
      return t.length > 80 && !t.includes("Season") && !t.includes("Episode");
    }).first().text().trim() || null;

    // ── Duration
    const durationNode = $("p, span").filter((_, el) =>
      /\d+\s*min/.test($(el).text())
    ).first();
    const duration = durationNode.length
      ? durationNode.text().trim().match(/\d+\s*min/)?.[0] || null
      : null;

    // ── Year
    const yearNode = $("p, span").filter((_, el) =>
      /^\d{4}$/.test($(el).text().trim())
    ).first();
    const year = yearNode.length ? yearNode.text().trim() : null;

    // ── Genres (category links under /category/genre/)
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

    // ── Network (e.g. Sony Yay, Crunchyroll)
    const networkImg = $("a[href*='/category/network/'] img").first();
    const network = networkImg.length
      ? (networkImg.attr("alt") || networkImg.attr("title") || null)
      : null;

    // ── "Play S:5-E:220" → latest episode link
    const latestEpLink = $("a[href*='/episode/']").filter((_, a) =>
      $(a).text().toLowerCase().includes("play")
    ).first().attr("href") || null;

    // ── Season tabs (real structure: <li> with text "Season 1", etc.)
    const seasonNumbers = [];
    $("li").each((_, li) => {
      const text = $(li).text().trim();
      const m = text.match(/^Season\s+(\d+)$/i);
      if (m) {
        const n = parseInt(m[1]);
        if (!seasonNumbers.includes(n)) seasonNumbers.push(n);
      }
    });
    seasonNumbers.sort((a, b) => a - b);

    // ── Episodes (all visible on page — site loads the selected season's episodes)
    // Structure: <li> > <a href="/episode/naruto-5x220/"> + <span>5x220</span> + <h2>title</h2> + <img>
    const episodesOnPage = [];
    $("a[href*='/episode/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const epSlug = extractSlug(href, "episode");
      if (!epSlug) return;

      // Parse season and episode number from slug pattern: naruto-5x220
      const mEp = epSlug.match(/-(\d+)x(\d+)$/);
      const seasonNum = mEp ? parseInt(mEp[1]) : null;
      const epNum = mEp ? parseInt(mEp[2]) : null;

      const $parent = $(a).closest("li");
      const label = $parent.find("span").first().text().trim() || (mEp ? `${mEp[1]}x${mEp[2]}` : null);
      const epTitle = $parent.find("h2").first().text().trim() || null;
      const epPoster = $parent.find("img").first().attr("src") || null;

      episodesOnPage.push({
        episodeId: epSlug,
        label,
        title: epTitle,
        poster: epPoster,
        seasonNumber: seasonNum,
        episodeNumber: epNum,
        url: href,
      });
    });

    // Group episodes by season
    const seasonMap = {};
    episodesOnPage.forEach(ep => {
      const sn = ep.seasonNumber || 0;
      if (!seasonMap[sn]) seasonMap[sn] = [];
      seasonMap[sn].push(ep);
    });

    // If we found season tabs but no grouped episodes, build empty season shells
    const seasons = seasonNumbers.length > 0
      ? seasonNumbers.map(n => ({
          seasonNumber: n,
          label: `Season ${n}`,
          episodes: seasonMap[n] || [],
        }))
      : Object.keys(seasonMap)
          .map(n => parseInt(n))
          .filter(n => n > 0)
          .sort((a, b) => a - b)
          .map(n => ({
            seasonNumber: n,
            label: `Season ${n}`,
            episodes: seasonMap[n] || [],
          }));

    return ok(res, {
      source: `watchanimeworld.net/series/${id}`,
      series: {
        seriesId: id,
        title,
        poster,
        backdrop,
        overview,
        year,
        duration,
        genres,
        languages,
        network,
        totalSeasons: totalSeasons || seasons.length || null,
        totalEpisodes,
        latestEpisodeUrl: latestEpLink,
      },
      seasons,
    });
  } catch (err) {
    return fail(res, err.message);
  }
};
