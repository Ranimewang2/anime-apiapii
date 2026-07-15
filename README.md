# AnimeWorld India API v2

**Built from live site inspection of watchanimeworld.net** — every selector verified against real HTML.

---

## Deploy

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. No build settings needed — Vercel auto-detects `/api` serverless functions
4. Deploy ✓

Requires **Node.js 18+** (Vercel default). Only dependency: `cheerio`.

---

## Endpoints

Base: `https://your-project.vercel.app`

---

### `GET /api/v1/home`
Homepage — latest series and movies.

**No parameters.**

```json
{
  "success": true,
  "latest_series": [
    { "title": "Naruto", "poster": "https://...", "seriesId": "naruto", "url": "https://..." }
  ],
  "latest_movies": [
    { "title": "Demon Slayer Movie", "poster": "https://...", "movieId": "demon-slayer-...", "url": "https://..." }
  ]
}
```

---

### `GET /api/v1/series?page=1`
Browse all series (paginated, 10 per page, 38+ pages).

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `page` | ❌ | 1 | Page number |

```json
{
  "success": true,
  "current_page": 1,
  "total_pages": 38,
  "has_next": true,
  "has_prev": false,
  "series": [
    { "title": "Naruto", "poster": "...", "year": "2002", "seriesId": "naruto", "url": "..." }
  ]
}
```

---

### `GET /api/v1/movies?page=1`
Browse all movies (paginated).

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `page` | ❌ | 1 | Page number |

---

### `GET /api/v1/search?query=naruto`
Search the site.

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `query` | ✅ | — | Search keyword |
| `page` | ❌ | 1 | Page number |

```json
{
  "success": true,
  "query": "naruto",
  "results": [
    {
      "title": "Naruto",
      "poster": "...",
      "type": "series",
      "seriesId": "naruto",
      "url": "..."
    }
  ]
}
```

---

### `GET /api/v1/series-detail?id=naruto`
Full series details — metadata, seasons, and episode list.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Series slug (from URL: `/series/{id}/`) |

```json
{
  "success": true,
  "series": {
    "seriesId": "naruto",
    "title": "Naruto",
    "poster": "https://image.tmdb.org/...",
    "overview": "In another world, ninja are the ultimate power...",
    "year": "2002",
    "duration": "24 min",
    "genres": ["Action", "Adventure", "Fantasy"],
    "languages": ["Hindi", "Tamil", "Telugu", "English"],
    "network": "Sony Yay",
    "totalSeasons": 5,
    "totalEpisodes": 220,
    "latestEpisodeUrl": "https://watchanimeworld.net/episode/naruto-5x220/"
  },
  "seasons": [
    {
      "seasonNumber": 1,
      "label": "Season 1",
      "episodes": [
        {
          "episodeId": "naruto-1x1",
          "label": "1x1",
          "title": "Enter: Naruto Uzumaki!",
          "poster": "https://img.watchanimeworld.net/...",
          "seasonNumber": 1,
          "episodeNumber": 1,
          "url": "https://watchanimeworld.net/episode/naruto-1x1/"
        }
      ]
    }
  ]
}
```

> **Note:** The site only loads the currently-selected season's episodes on the page.
> To get all episodes for all seasons, call this endpoint once per season tab.

---

### `GET /api/v1/movie-detail?id=demon-slayer-kimetsu-no-yaiba-infinity-castle`
Full movie details + stream server URLs.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Movie slug (from URL: `/movies/{id}/`) |

```json
{
  "success": true,
  "movie": {
    "movieId": "demon-slayer-kimetsu-no-yaiba-infinity-castle",
    "title": "Demon Slayer: Kimetsu no Yaiba Infinity Castle",
    "poster": "https://image.tmdb.org/...",
    "overview": "As the Demon Slayer Corps...",
    "year": "2025",
    "duration": "2h 35m",
    "genres": ["Action", "Adventure", "Drama"],
    "languages": ["Hindi", "Japanese", "Tamil", "Telugu"],
    "network": "Crunchyroll"
  },
  "servers": [
    { "name": "Server 1 Play", "url": "https://play.zephyrflick.top/video/..." },
    { "name": "Server 2 Abyss", "url": "https://..." }
  ]
}
```

---

### `GET /api/v1/episode?id=naruto-1x1`
Episode watch page — stream servers, prev/next navigation, and all episode list.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Episode slug format: `{series-slug}-{season}x{episode}` |

**Episode ID examples:**
- `naruto-1x1` → Naruto Season 1 Episode 1
- `naruto-5x220` → Naruto Season 5 Episode 220
- `one-piece-1x1` → One Piece Season 1 Episode 1
- `demon-slayer-1x1` → Demon Slayer Season 1 Episode 1

```json
{
  "success": true,
  "episode": {
    "episodeId": "naruto-1x1",
    "label": "1x1",
    "title": "Enter: Naruto Uzumaki!",
    "seasonNumber": 1,
    "episodeNumber": 1,
    "seriesId": "naruto",
    "seriesTitle": "Naruto",
    "poster": "https://img.watchanimeworld.net/...",
    "url": "https://watchanimeworld.net/episode/naruto-1x1/"
  },
  "servers": [
    { "name": "Server 1", "url": "https://play.zephyrflick.top/video/..." }
  ],
  "prev": null,
  "next": "naruto-1x2",
  "all_episodes": [
    { "episodeId": "naruto-1x1", "label": "1x1", "title": "...", "poster": "...", "url": "..." }
  ]
}
```

---

### `GET /api/v1/a2z?letter=N`
Browse all titles starting with a letter.

| Param | Required | Description |
|-------|----------|-------------|
| `letter` | ✅ | A–Z or `0-9` for numbers |
| `page` | ❌ | Page number (default 1) |

---

## Error Responses

All errors return:
```json
{ "success": false, "error": "Descriptive error message" }
```

HTTP status codes:
- `400` — missing/invalid parameter
- `500` — upstream fetch failed (site may be down or blocked the request)

---

## How Stream URLs Work

The site embeds player URLs like `https://play.zephyrflick.top/video/{hash}`.
The `movie-detail` and `episode` endpoints extract these and return them in the `servers` array.
These are third-party embeds — their availability depends on the stream host, not this API.

---

## Caveats

This API scrapes a live site. It can break if:
- The site changes its HTML structure
- The site adds bot protection (Cloudflare, reCAPTCHA)
- The site goes down

If you start getting empty results, the selectors likely need updating to match the new HTML.
