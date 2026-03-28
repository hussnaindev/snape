# Heroflix — Streaming Site Build Plan

## Refined Product Description

Heroflix is a cinematic, dark-themed movie streaming web app that lets users browse, discover, and stream movies directly in the browser. It pulls rich metadata (posters, synopsis, cast, genres, ratings) from the TMDB API, sources torrent magnet links via the YTS public API, streams video natively in-browser using WebTorrent.js over WebRTC, and plays trailers through a YouTube façade (no YouTube branding or recommendations visible). The UI is inspired by a luxury, minimalist video platform aesthetic: deep blacks, sage green / champagne gold accents, `Archivo Narrow` + `Cormorant Garamond` typography, scroll-snap hero sections, edge-to-edge movie grids, and spring-eased micro-animations. Fully responsive on mobile (primary) and desktop.

---

## Tech Stack (additions to base)

| Concern              | Tool                                          |
| -------------------- | --------------------------------------------- |
| Movie metadata       | TMDB API (v3, REST)                           |
| Torrent source       | Torrentio API (torrentio.strem.fun) ✅ verified |
| In-browser streaming | WebTorrent.js (WebRTC peer-to-peer streaming) |
| Trailer playback     | YouTube IFrame API via `youtube-nocookie.com` |
| Video UI             | Custom player built on `<video>` + WebTorrent |

---

## Data Sources

### 1. TMDB API
- **What it provides**: Titles, posters, backdrops, synopsis, genres, ratings, release dates, cast, crew, trailers (YouTube keys), actor bios, filmographies.
- **Cost**: Free tier (rate-limited); requires a free API key from themoviedb.org.
- **Key endpoints used**:
  - `GET /trending/movie/week` — trending movies for homepage hero / carousels
  - `GET /movie/popular`, `/movie/top_rated`, `/movie/now_playing` — homepage sections
  - `GET /movie/{id}` — movie detail (runtime, tagline, genres, budget, etc.)
  - `GET /movie/{id}/credits` — cast + crew
  - `GET /movie/{id}/videos` — trailer YouTube keys
  - `GET /movie/{id}/recommendations` — "More like this" rail
  - `GET /person/{id}` — actor bio, birthday, profile image
  - `GET /person/{id}/movie_credits` — actor filmography
  - `GET /search/movie` — search

### 2. Torrentio (Torrent Source) ✅ Verified Live
- **What it provides**: Stream metadata (infoHash, quality label, source, file index) aggregated from YTS, EZTV, 1337x, ThePirateBay, KickassTorrents, TorrentGalaxy, and more.
- **Cost**: Free, public, no auth required.
- **Base URL**: `https://torrentio.strem.fun`
- **Key endpoint**:
  - `GET /stream/movie/{imdb_id}.json` — returns all available streams for a movie by IMDB ID
  - Response includes `streams[]` each with `name` (quality label e.g. "1080p"), `title` (torrent name), `infoHash` (64-char hex), `fileIdx`, and `sources` (tracker list)
- **Verified**: Live test against `tt0111161` (Shawshank Redemption) returned **51 streams** across 4K HDR, 1080p, and 720p qualities.
- **Magnet construction**: `magnet:?xt=urn:btih:{infoHash}&dn={title}&tr=udp://tracker.opentrackr.org:1337/announce` — built client-side, fed directly to WebTorrent.
- **Coverage**: Multi-source aggregation means far broader catalog than YTS alone.
- **Note**: When no streams are returned, the Watch button is hidden gracefully and replaced with a "Streaming unavailable" notice.

> **Why not raw YTS API?** YTS.mx is regionally blocked in some countries (returns 504 in affected regions). Torrentio is globally accessible, tested live, and covers a wider catalog by pulling from multiple indexers.

### 3. YouTube (Trailers)
- **What it provides**: Official trailers sourced from TMDB's `/videos` endpoint (which returns YouTube video keys).
- **Façade approach**: Trailers play inside a custom-styled modal using `youtube-nocookie.com` embeds with parameters:
  - `autoplay=1`, `modestbranding=1`, `rel=0`, `showinfo=0`, `iv_load_policy=3`
  - This removes branding, related video suggestions, and info cards — making it feel native to the site.
- The modal has a full-bleed dark overlay, custom close button, and no YouTube chrome visible.

---

## Architecture

```
app/
  (routes)/
    page.tsx                    ← Homepage
    movie/[id]/page.tsx         ← Movie detail page
    person/[id]/page.tsx        ← Actor/actress detail page
  api/
    tmdb/[...path]/route.ts     ← TMDB proxy (keeps API key server-side)
    torrentio/route.ts          ← Torrentio proxy (avoids CORS, caches results)
    health/route.ts             ← Existing health check

components/
  ui/
    skeleton.tsx                ← Shimmer skeleton loader
    tag-chip.tsx                ← Genre/tag pill
    section-divider.tsx         ← Icon + label divider line
    rating-badge.tsx            ← TMDB rating display
  topbar.tsx                    ← Fixed nav with gradient fade
  hero-section.tsx              ← Full-width backdrop hero with movie info
  movie-card.tsx                ← Portrait card (poster + hover overlay)
  movie-grid.tsx                ← Responsive grid of movie cards
  movie-carousel.tsx            ← Horizontal scroll rail
  trailer-modal.tsx             ← YouTube nocookie embed modal
  player-modal.tsx              ← WebTorrent streaming player modal
  quality-selector.tsx          ← 720p / 1080p / 4K buttons
  cast-rail.tsx                 ← Horizontal scrolling cast cards
  person-card.tsx               ← Actor portrait + name card

lib/
  tmdb.ts                       ← Typed TMDB fetch helpers + types
  torrentio.ts                  ← Typed Torrentio fetch helpers
  webtorrent-client.ts          ← Client-side WebTorrent singleton

types/
  tmdb.ts                       ← TMDB API response types
  torrentio.ts                  ← Torrentio API response types
```

---

## Pages

### 1. Homepage (`/`)

**Sections (top to bottom)**:

1. **Topbar** — Fixed, gradient-fade background, "HEROFLIX" wordmark in `Cormorant Garamond`, search icon.
2. **Hero Spotlight** — Full-viewport backdrop of trending movie #1. Overlaid: title, tagline, genres, rating, "Watch" + "Trailer" buttons. Auto-cycles through top 5 trending movies with a dot indicator. Background uses `object-fit: cover` backdrop image with a `linear-gradient` dark overlay from bottom.
3. **Trending This Week** — Horizontal scroll rail of movie cards. Section header uses the icon + uppercase label divider pattern from the inspiration project.
4. **Now Playing** — Same rail pattern.
5. **Top Rated** — Same rail pattern.
6. **Browse by Genre** — Tag chip grid (Action, Drama, Horror, Sci-Fi, etc.). Clicking a genre navigates to a filtered grid view.
7. **Popular on Heroflix** — 4-column (desktop) / 2-column (mobile) edge-to-edge poster grid, infinite scroll.

**Movie Card**:
- Portrait aspect ratio (2:3)
- On hover: scale(1.03) zoom on poster + overlay reveals title, year, rating badge
- Shows a small "HD" or "4K" badge if torrent in that quality is available

---

### 2. Movie Detail Page (`/movie/[id]`)

**Layout**:

1. **Backdrop Hero** — Full-width TMDB backdrop image, tall (~60vh), dark gradient overlay at bottom. Floating back-button (`←`) top-left.
2. **Info Block** (overlaid on hero bottom / below on mobile):
   - Poster thumbnail (left, portrait)
   - Title (large, `Cormorant Garamond`)
   - Tagline (italic, muted)
   - Metadata row: Year · Runtime · Rating (TMDB) · Genres (tag chips)
   - Action buttons:
     - **Watch** (sage green CTA) — opens quality selector then player modal
     - **Trailer** — opens trailer modal
     - **Not Available** state (muted, disabled) if no YTS torrent found
3. **Synopsis** — Body text section.
4. **Cast Rail** — "Starring" section divider + horizontal scroll of person cards (portrait photo, name, character name).
5. **More Like This** — Same movie grid/rail pattern.

**Player Modal** (WebTorrent):
- Full-screen dark overlay
- `<video>` element rendered to by WebTorrent
- Custom controls: play/pause, seek bar (sage green fill), volume, fullscreen, quality selector
- Loading state: spinner + "Connecting to peers..." text
- WebTorrent streams the torrent file progressively; playback starts as soon as enough buffer is available
- Quality selection (720p / 1080p / 4K) re-initializes the torrent with the selected hash

**Trailer Modal** (YouTube façade):
- Full-screen overlay with blurred backdrop
- `<iframe>` pointing to `https://www.youtube-nocookie.com/embed/{key}?autoplay=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&color=white`
- 16:9 aspect ratio container
- Custom close button (top-right `×`) — pauses and removes iframe on close to stop audio

---

### 3. Actor/Actress Detail Page (`/person/[id]`)

**Layout**:

1. **Profile Hero** — Dark background, large profile photo (centered portrait), name, known-for department badge.
2. **Bio Block** — Birthday, birthplace, biography text (collapsed with "Read more" on mobile).
3. **Known For** — Top 6–8 movies this person is most associated with (horizontal scroll rail).
4. **Full Filmography** — Sorted by release date desc, grouped by decade. Each entry is a compact row: poster thumbnail · title · year · character name.

---

## Responsive Behavior

| Element           | Mobile                              | Desktop                          |
| ----------------- | ----------------------------------- | -------------------------------- |
| Topbar            | Logo + hamburger (future)           | Logo + search + nav links        |
| Hero              | 16:11 aspect, stacked info below    | 16:9, info overlaid bottom-left  |
| Movie Grid        | 2 columns                           | 4–5 columns                      |
| Cast Rail         | Horizontal scroll, 3 cards visible  | Horizontal scroll, 6 visible     |
| Player Modal      | Full-screen (near-fullscreen)       | Centered, max-width 1100px       |
| Trailer Modal     | Full-screen                         | Centered 70vw                    |
| Movie Detail Hero | Stacked (backdrop → info below)     | Overlaid on tall hero            |

---

## Design Tokens (from Inspiration Project)

```css
--black:       #070b08;
--sage:        #a8d5b5;   /* primary accent — CTAs, progress, active states */
--gold:        #d4af6e;   /* secondary accent — typography, dividers */
--like:        #e05a5a;   /* favorite/bookmark active state */

/* Typography */
--font-body:   'Archivo Narrow', sans-serif;
--font-display:'Cormorant Garamond', serif;

/* Borders */
--border-subtle: rgba(255, 255, 255, 0.10);
--border-mid:    rgba(255, 255, 255, 0.15);

/* Overlays */
--overlay-dark:  rgba(0, 0, 0, 0.65);
--overlay-card:  rgba(7, 11, 8, 0.88);
```

---

## Implementation Phases

### Phase 1 — Foundation & Data Layer
- [ ] Set up env vars: `TMDB_API_KEY`, `NEXT_PUBLIC_TMDB_IMAGE_BASE`
- [ ] Build TMDB proxy API route (`app/api/tmdb/[...path]/route.ts`)
- [ ] Build Torrentio proxy API route (`app/api/torrentio/route.ts`)
- [ ] Write typed `lib/tmdb.ts` + `lib/torrentio.ts` helpers
- [ ] Add TMDB + Torrentio types to `types/`

### Phase 2 — Design System Components
- [ ] Global CSS: design tokens, fonts (Google Fonts import), base reset
- [ ] `Topbar` — fixed, gradient-fade
- [ ] `SectionDivider` — icon + label + horizontal lines
- [ ] `Skeleton` — shimmer animation
- [ ] `TagChip` — genre pill
- [ ] `MovieCard` — poster card with hover overlay
- [ ] `RatingBadge` — TMDB score badge

### Phase 3 — Homepage
- [ ] `HeroSpotlight` — auto-cycling trending hero
- [ ] `MovieCarousel` — horizontal scroll rails
- [ ] `MovieGrid` — responsive poster grid
- [ ] Assemble homepage (`app/page.tsx`) with all sections

### Phase 4 — Movie Detail Page
- [ ] `TrailerModal` — YouTube nocookie façade
- [ ] `QualitySelector` — 720p/1080p/4K buttons
- [ ] `PlayerModal` — WebTorrent `<video>` player with custom controls
- [ ] `CastRail` — horizontal cast scroll
- [ ] Assemble movie detail page (`app/movie/[id]/page.tsx`)

### Phase 5 — Person Detail Page
- [ ] `PersonCard` — actor portrait card
- [ ] Assemble person detail page (`app/person/[id]/page.tsx`)

### Phase 6 — Polish & Responsive QA
- [ ] Mobile layout QA across all pages
- [ ] Skeleton loading states on all data-fetching components
- [ ] Error states (no torrent found, TMDB fetch failure)
- [ ] Smooth page transitions
- [ ] Performance: lazy-load images, dynamic import WebTorrent (heavy lib)

---

## Environment Variables Needed

```bash
# .env.local
TMDB_API_KEY=your_tmdb_v3_api_key_here
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

TMDB API key: free at https://www.themoviedb.org/settings/api
YTS API: no key required (public API)

---

## Key Technical Decisions

1. **WebTorrent via dynamic import** — WebTorrent is browser-only and ~300KB. Import it only client-side inside the player modal using `next/dynamic` with `ssr: false`.
2. **TMDB + Torrentio via server-side proxy routes** — Keeps TMDB API key private, enables `Cache-Control: s-maxage` caching, avoids CORS issues.
3. **YouTube façade** — Trailers load as an `<iframe>` only when the user clicks "Trailer", not on page load. `youtube-nocookie.com` + `rel=0` + `modestbranding=1` hide all YouTube branding. The `<iframe>` is removed from DOM on modal close to stop playback.
4. **TMDB ↔ Torrentio linking** — TMDB's movie detail response includes `imdb_id`. Torrentio's endpoint is `/stream/movie/{imdb_id}.json` — no secondary lookup needed, the two sources link directly.
5. **Graceful degradation** — If Torrentio returns no streams for a film, the Watch button is replaced with a muted "Streaming unavailable" label. The page is still fully useful for discovery.
