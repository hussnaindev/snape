// Desktop: home carousels (right), sidebar search + results (left), player (right).
// All MovieBox calls through window.api. Continue watching via localStorage.

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerStatus = document.getElementById('player-status');
const idle = document.getElementById('idle');
const homeContent = document.getElementById('home-content');
const carouselsEl = document.getElementById('carousels');
const backBtn = document.getElementById('back-btn');

const player = window.createStreamPlayer(video, overlay);
let searchSeq = 0;
let playToken = 0;

let current = null;

// --- localStorage helpers for continue watching ------------------------------

const CW_KEY = 'snape_cw_history';
const EP_KEY = 'snape_ep_progress';
const FINISHED_FRAC = 0.95;

function cwLoad() {
  try { return JSON.parse(localStorage.getItem(CW_KEY)) || []; } catch { return []; }
}
function cwSave(data) {
  localStorage.setItem(CW_KEY, JSON.stringify(data));
}
function epLoad() {
  try { return JSON.parse(localStorage.getItem(EP_KEY)) || []; } catch { return []; }
}
function epSave(data) {
  localStorage.setItem(EP_KEY, JSON.stringify(data));
}

function continueWatching() {
  return cwLoad().filter(e => !(e.durationMs > 0 && e.positionMs >= e.durationMs * FINISHED_FRAC));
}

// Normalize stored item → card-like object for rendering
function cwItemToCard(item) {
  return {
    subjectId: item.subjectId,
    subjectType: item.subjectType,
    isSeries: item.isSeries !== undefined ? item.isSeries : item.subjectType === 2,
    title: item.cleanTitle || item.title,
    year: (item.releaseDate || '').slice(0, 4),
    posterUrl: item.posterUrl || item.cover?.url || null,
    rating: item.rating != null ? item.rating : (item.imdbRatingValue ? Number.parseFloat(item.imdbRatingValue) : null),
    duration: item.duration || '',
  };
}

function recordProgress(item, se, ep, positionMs, durationMs) {
  if (positionMs <= 0) return;
  const now = Date.now();
  let history = cwLoad();
  history = [{ item, se, ep, positionMs, durationMs, updatedAt: now }]
    .concat(history.filter(h => h.item.subjectId !== item.subjectId));
  history = history.slice(0, 50);
  cwSave(history);

  let eps = epLoad();
  eps = [{ subjectId: item.subjectId, se, ep, positionMs, durationMs }]
    .concat(eps.filter(p => !(p.subjectId === item.subjectId && p.se === se && p.ep === ep)));
  eps = eps.slice(0, 500);
  epSave(eps);

  // Refresh continue watching carousel in real-time
  refreshCWCarousel();
}

function progressFor(subjectId, se, ep) {
  const eps = epLoad();
  const entry = eps.find(p => p.subjectId === subjectId && p.se === se && p.ep === ep);
  if (!entry) return null;
  if (entry.durationMs > 0 && entry.positionMs >= entry.durationMs * FINISHED_FRAC) return null;
  return entry.positionMs;
}

// --- home feed / carousels ---------------------------------------------------

const CAROUSEL_SPECS = [
  { key: 'continue', label: 'Continue Watching' },
  { key: 'trending_movies', label: 'Trending Movies' },
  { key: 'trending_series', label: 'Trending Series' },
  { key: 'animated_movies', label: 'Animated Movies' },
  { key: 'anime', label: 'Anime' },
];

async function loadHomeFeed() {
  try {
    const feed = await window.api.homeFeed();
    const rows = (feed.items || []).filter(r => r.type === 'SUBJECTS_MOVIE' && r.subjects && r.subjects.length > 0);

    const findRow = (titleMatch) => {
      const row = rows.find(r => r.title && r.title.toLowerCase().includes(titleMatch.toLowerCase()));
      return row ? (row.subjects || []).filter(s => s.hasResource && s.cover?.url) : [];
    };

    const continueEntries = continueWatching();

    const trendingMovies = findRow('Trending').filter(s => s.subjectType === 1).slice(0, 10);
    const trendingSeries = findRow('Top Series').filter(s => s.subjectType === 2).slice(0, 10);

    // For animated movies: search MovieBox with subjectType=1 (movies)
    // For anime: search MovieBox with subjectType=2 (series) since most anime are series
    // Try home feed first, fallback to keyword search
    let animatedMovies = findRow('Animation').filter(s => s.subjectType === 1).slice(0, 10);
    let anime = findRow('Anime').filter(s => s.subjectType === 2).slice(0, 10);

    // Fallback to keyword search if home feed has no matching row
    if (animatedMovies.length === 0) {
      try {
        const res = await window.api.searchByType('animated', 1, 1);
        animatedMovies = (res || []).slice(0, 10);
      } catch {}
    }
    if (anime.length === 0) {
      try {
        const res = await window.api.searchByType('anime', 2, 1);
        anime = (res || []).slice(0, 10);
      } catch {}
    }

    const sections = [
      { key: 'continue', label: 'Continue Watching', cards: continueEntries, feedSubjects: null },
      { key: 'trending_movies', label: 'Trending Movies', cards: null, feedSubjects: trendingMovies },
      { key: 'trending_series', label: 'Trending Series', cards: null, feedSubjects: trendingSeries },
      { key: 'animated_movies', label: 'Animated Movies', cards: null, feedSubjects: animatedMovies },
      { key: 'anime', label: 'Anime', cards: null, feedSubjects: anime },
    ];

    renderCarousels(sections);
  } catch (err) {
    carouselsEl.innerHTML = `<div class="section" style="color:var(--muted);padding:40px;text-align:center;font-size:14px;">Failed to load: ${err.message}</div>`;
  }
}

// Refresh only the Continue Watching carousel in-place (real-time updates)
function refreshCWCarousel() {
  const cwSection = carouselsEl.querySelector('.section[data-key="continue"]');
  if (!cwSection) return; // not rendered yet, skip
  const carousel = cwSection.querySelector('.carousel');
  if (!carousel) return;
  const entries = continueWatching();
  carousel.innerHTML = '';
  if (entries.length === 0) {
    cwSection.classList.add('hidden');
    return;
  }
  cwSection.classList.remove('hidden');
  for (const entry of entries) {
    const card = cwEntryToCard(entry);
    const cardEl = createPosterCard(
      card.posterUrl,
      card.isSeries,
      card.rating,
      card.title,
      card.subjectId,
      card.subjectType,
      card.duration,
      entry.fraction,
    );
    cardEl.addEventListener('click', () => {
      const c = { ...card, _resumeSe: entry.se, _resumeEp: entry.ep, _positionMs: entry.positionMs };
      onCarouselCardClick(c);
    });
    carousel.appendChild(cardEl);
  }
}

function cwEntryToCard(entry) {
  return {
    subjectId: entry.item.subjectId,
    subjectType: entry.item.subjectType,
    isSeries: entry.item.isSeries !== undefined ? entry.item.isSeries : entry.item.subjectType === 2,
    title: entry.item.cleanTitle || entry.item.title,
    year: (entry.item.releaseDate || '').slice(0, 4),
    posterUrl: entry.item.posterUrl || entry.item.cover?.url || null,
    rating: entry.item.rating != null ? entry.item.rating : (entry.item.imdbRatingValue ? Number.parseFloat(entry.item.imdbRatingValue) : null),
    duration: entry.item.duration || '',
  };
}

function renderCarousels(sections) {
  carouselsEl.innerHTML = '';
  for (const sec of sections) {
    // Skip continue watching section entirely if empty
    if (sec.key === 'continue' && (!sec.cards || sec.cards.length === 0)) {
      continue;
    }

    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section';
    sectionDiv.dataset.key = sec.key;

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<span class="section-title">${sec.label}</span><span class="section-bar"></span>`;
    sectionDiv.appendChild(header);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    if (sec.key === 'continue') {
      for (const entry of sec.cards) {
        const card = cwEntryToCard(entry);
        const cardEl = createPosterCard(
          card.posterUrl,
          card.isSeries,
          card.rating,
          card.title,
          card.subjectId,
          card.subjectType,
          card.duration,
          entry.fraction,
        );
        cardEl.addEventListener('click', () => {
          const c = { ...card, _resumeSe: entry.se, _resumeEp: entry.ep, _positionMs: entry.positionMs };
          onCarouselCardClick(c);
        });
        carousel.appendChild(cardEl);
      }
    } else {
      const subjects = sec.feedSubjects || sec.cards || [];
      if (subjects.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:var(--muted);font-size:13px;padding:8px 0;';
        empty.textContent = 'No titles available.';
        carousel.appendChild(empty);
      } else {
        for (const sub of subjects) {
          const posterUrl = sub.cover?.url || sub.posterUrl;
          const title = sub.cleanTitle || sub.title;
          const rating = sub.rating || (sub.imdbRatingValue ? Number.parseFloat(sub.imdbRatingValue) : null);
          const isSeries = sub.isSeries || sub.subjectType === 2;
          const card = createPosterCard(posterUrl, isSeries, rating, title, sub.subjectId, sub.subjectType, sub.duration);
          card.addEventListener('click', () => {
            const c = {
              subjectId: sub.subjectId,
              isSeries,
              subjectType: sub.subjectType || (isSeries ? 2 : 1),
              title,
              year: (sub.releaseDate || sub.year || '').slice(0, 4),
              posterUrl,
              rating,
              duration: sub.duration || '',
            };
            onCarouselCardClick(c);
          });
          carousel.appendChild(card);
        }
      }
    }

    sectionDiv.appendChild(carousel);
    carouselsEl.appendChild(sectionDiv);
  }
}

function createPosterCard(posterUrl, isSeries, rating, title, subjectId, subjectType, duration, progress) {
  const div = document.createElement('div');
  div.className = 'pcard';
  div.innerHTML = `
    <div class="pcard-inner">
      ${posterUrl
        ? `<img class="pcard-img" loading="lazy" src="${posterUrl}" alt="">`
        : `<div class="pcard-img-placeholder">No Image</div>`}
      <div class="pcard-chips">
        <span class="pcard-chip">${isSeries ? 'SERIES' : 'FILM'}</span>
        ${rating ? `<span class="pcard-chip">★ ${rating.toFixed(1)}</span>` : ''}
      </div>
      <div class="pcard-title-band">
        <div class="pcard-title">${(title || '').toUpperCase()}</div>
      </div>
      ${progress != null && progress > 0
        ? `<div class="pcard-progress-track"><div class="pcard-progress-fill" style="width:${(progress * 100).toFixed(1)}%"></div></div>`
        : ''}
    </div>`;
  return div;
}

// --- now-playing section in sidebar ------------------------------------------

function showNowPlaying(card, entry) {
  let np = document.getElementById('now-playing');
  if (!np) {
    np = document.createElement('div');
    np.id = 'now-playing';
    np.className = 'now-playing';
    const head = document.querySelector('.sidebar-head');
    head.parentNode.insertBefore(np, head.nextSibling);
  }
  const se = entry ? `S${entry.se} E${entry.ep}` : '';
  const kind = card.isSeries ? 'SERIES' : 'FILM';
  np.innerHTML = `
    <div class="now-playing-label">Now Playing</div>
    <div class="now-playing-title">${card.title}</div>
    <div class="now-playing-meta">${kind}${card.year ? ' · ' + card.year : ''}${se ? ' · ' + se : ''}</div>
  `;
}

function hideNowPlaying() {
  const np = document.getElementById('now-playing');
  if (np) np.remove();
}

let carouselResultItem = null; // tracks the one result item added from carousel

// --- carousel card click -----------------------------------------------------

async function onCarouselCardClick(card) {
  showHomeContent(false);
  showPlayer(true);
  idle.classList.add('hidden');

  const chips = [
    `<span class="chip">${card.isSeries ? 'SERIES' : 'FILM'}</span>`,
    card.year ? `<span class="chip">${card.year}</span>` : '',
    card.rating ? `<span class="chip">★ ${card.rating.toFixed(1)}</span>` : '',
    !card.isSeries && card.duration ? `<span class="chip">${card.duration}</span>` : '',
  ].filter(Boolean).join('');

  // Reuse the existing carousel result item if it exists, otherwise create one
  let item = carouselResultItem;
  if (item) {
    // Update existing item
    item.querySelector('.thumb').innerHTML = card.posterUrl ? `<img loading="lazy" src="${card.posterUrl}" alt="">` : '';
    item.querySelector('.r-title').textContent = card.title;
    item.querySelector('.chips').innerHTML = chips;
    if (card.isSeries) {
      let panel = item.querySelector('.series-panel');
      if (!panel) {
        const btn = item.querySelector('.result');
        item.insertAdjacentHTML('beforeend', '<div class="series-panel hidden"></div>');
        const chevron = document.createElement('span');
        chevron.className = 'chevron';
        chevron.textContent = '▾';
        btn.appendChild(chevron);
        panel = item.querySelector('.series-panel');
      }
      panel.classList.add('hidden');
    } else {
      const panel = item.querySelector('.series-panel');
      if (panel) panel.remove();
      const chevron = item.querySelector('.chevron');
      if (chevron) chevron.remove();
    }
  } else {
    item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <button class="result active">
        <div class="thumb">${card.posterUrl ? `<img loading="lazy" src="${card.posterUrl}" alt="">` : ''}</div>
        <div class="info">
          <div class="r-title">${card.title}</div>
          <div class="chips">${chips}</div>
        </div>
        ${card.isSeries ? '<span class="chevron">▾</span>' : ''}
      </button>
      ${card.isSeries ? '<div class="series-panel hidden"></div>' : ''}`;
    results.insertBefore(item, results.firstChild);
    carouselResultItem = item;
  }

  const rowEl = item.querySelector('.result');
  
  // Save for progress tracking
  const resumeSe = card._resumeSe || 0;
  const resumeEp = card._resumeEp || 0;
  const startTime = card._positionMs ? card._positionMs / 1000 : 0;

  if (!card.isSeries) {
    clearActive();
    rowEl.classList.add('active');
    startMovie(card, startTime);
    showNowPlaying(card, null);
  } else {
    clearActive();
    rowEl.classList.add('active', 'open');
    const panel = item.querySelector('.series-panel');
    panel.classList.remove('hidden');
    if (!card._seasons) {
      panel.innerHTML = '<div class="panel-msg">Loading seasons…</div>';
      card._seasons = await window.api.seasons(card.subjectId).catch(() => []);
    }
    const seasons = card._seasons;
    if (seasons.length > 0) {
      const seasonIdx = seasons.findIndex(s => s.se === resumeSe) >= 0
        ? seasons.findIndex(s => s.se === resumeSe) : 0;
      renderPanel(card, panel, seasons, seasonIdx);
      const targetEp = resumeEp > 0 ? resumeEp : 1;
      startEpisode(card, panel, seasons, seasonIdx, seasons[seasonIdx].se, targetEp, startTime);
      showNowPlaying(card, { se: seasons[seasonIdx].se, ep: targetEp });
    } else {
      panel.innerHTML = '<div class="panel-msg">No episodes found.</div>';
    }
  }
}

// --- search ------------------------------------------------------------------

let debounce;
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(runSearch, 350);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(debounce);
  runSearch();
});

async function runSearch() {
  const keyword = input.value.trim();
  const seq = ++searchSeq;
  if (!keyword) {
    results.innerHTML = '';
    status.textContent = '';
    return;
  }
  status.textContent = 'Searching…';
  try {
    const cards = await window.api.search(keyword);
    if (seq !== searchSeq) return;
    renderResults(cards);
    status.textContent = cards.length ? '' : 'No results.';
  } catch (err) {
    if (seq !== searchSeq) return;
    results.innerHTML = '';
    status.textContent = `Search failed: ${err.message}`;
  }
}

function renderResults(cards) {
  // Preserve the carousel-added now-playing item across search re-renders
  results.innerHTML = '';
  if (carouselResultItem) results.appendChild(carouselResultItem);
  
  for (const c of cards) {
    const item = document.createElement('div');
    item.className = 'result-item';
    const chips = [
      `<span class="chip">${c.isSeries ? 'SERIES' : 'FILM'}</span>`,
      c.year ? `<span class="chip">${c.year}</span>` : '',
      c.rating ? `<span class="chip">★ ${c.rating.toFixed(1)}</span>` : '',
      !c.isSeries && c.duration ? `<span class="chip">${c.duration}</span>` : '',
    ]
      .filter(Boolean)
      .join('');
    item.innerHTML = `
      <button class="result">
        <div class="thumb">${c.posterUrl ? `<img loading="lazy" src="${c.posterUrl}" alt="">` : ''}</div>
        <div class="info">
          <div class="r-title"></div>
          <div class="chips">${chips}</div>
        </div>
        ${c.isSeries ? '<span class="chevron">▾</span>' : ''}
      </button>
      ${c.isSeries ? '<div class="series-panel hidden"></div>' : ''}`;
    item.querySelector('.r-title').textContent = c.title;
    const rowEl = item.querySelector('.result');
    rowEl.addEventListener('click', () => onRowClick(c, item, rowEl));
    results.appendChild(item);
  }
}

function clearActive() {
  results.querySelectorAll('.result.active').forEach((r) => r.classList.remove('active'));
  results.querySelectorAll('.series-panel').forEach((p) => {
    p.classList.add('hidden');
    p.previousElementSibling?.classList.remove('open');
  });
}

// --- row interaction --------------------------------------------------------

async function onRowClick(card, item, rowEl) {
  if (!card.isSeries) {
    clearActive();
    rowEl.classList.add('active');
    startMovie(card, 0);
    showNowPlaying(card, null);
    return;
  }
  const panel = item.querySelector('.series-panel');
  const wasOpen = !panel.classList.contains('hidden');
  clearActive();
  if (wasOpen) return;
  rowEl.classList.add('active', 'open');
  panel.classList.remove('hidden');
  if (!card._seasons) {
    panel.innerHTML = '<div class="panel-msg">Loading seasons…</div>';
    card._seasons = await window.api.seasons(card.subjectId).catch(() => []);
  }
  const seasons = card._seasons;
  if (!seasons.length) {
    panel.innerHTML = '<div class="panel-msg">No episodes found.</div>';
    return;
  }
  renderPanel(card, panel, seasons, 0);
  startEpisode(card, panel, seasons, 0, seasons[0].se, 1, 0);
  showNowPlaying(card, { se: seasons[0].se, ep: 1 });
}

function renderPanel(card, panel, seasons, seasonIdx) {
  const season = seasons[seasonIdx] || seasons[0];
  const pills =
    seasons.length > 1
      ? `<div class="season-pills">${seasons
          .map(
            (s, i) =>
              `<button class="season-pill${i === seasonIdx ? ' on' : ''}" data-si="${i}">SEASON ${s.se}</button>`,
          )
          .join('')}</div>`
      : '';
  const grid = `<div class="ep-grid">${Array.from(
    { length: season.maxEp },
    (_, i) => {
      const ep = i + 1;
      const on = current && current.card === card && current.se === season.se && current.ep === ep;
      return `<button class="ep-tile${on ? ' on' : ''}" data-ep="${ep}">${ep}</button>`;
    },
  ).join('')}</div>`;
  panel.innerHTML = pills + grid;
  panel.querySelectorAll('.season-pill').forEach((b) =>
    b.addEventListener('click', () => renderPanel(card, panel, seasons, Number(b.dataset.si))),
  );
  panel.querySelectorAll('.ep-tile').forEach((b) =>
    b.addEventListener('click', () => {
      const si = seasonIdx;
      const s = seasons[si];
      startEpisode(card, panel, seasons, si, s.se, Number(b.dataset.ep), 0);
      showNowPlaying(card, { se: s.se, ep: Number(b.dataset.ep) });
    }),
  );
}

// --- playback ---------------------------------------------------------------

function startMovie(card, startTime) {
  showHomeContent(false);
  showPlayer(true);
  idle.classList.add('hidden');
  current = {
    card,
    variantId: card.variants?.[0]?.id || card.subjectId,
    isSeries: false,
    se: 0,
    ep: 0,
  };
  loadCurrent(startTime);
}

function startEpisode(card, panel, seasons, seasonIdx, se, ep, startTime) {
  showHomeContent(false);
  showPlayer(true);
  idle.classList.add('hidden');
  current = {
    card,
    panel,
    seasons,
    seasonIdx,
    variantId: card.variants?.[0]?.id || card.subjectId,
    isSeries: true,
    se,
    ep,
  };
  highlightEpisode();
  loadCurrent(startTime);
}

function highlightEpisode() {
  if (!current?.panel) return;
  current.panel.querySelectorAll('.ep-tile').forEach((t) => {
    t.classList.toggle('on', Number(t.dataset.ep) === current.ep);
  });
}

function buildEpisodes() {
  if (!current?.isSeries) return [];
  const season = current.seasons[current.seasonIdx];
  return Array.from({ length: season.maxEp }, (_, i) => ({
    se: season.se,
    ep: i + 1,
    label: `E${i + 1}`,
  }));
}

let progressInterval = null;

async function loadCurrent(startTime) {
  const token = ++playToken;
  const { card, variantId, se, ep, isSeries } = current;
  playerStatus.textContent = 'Loading stream…';
  try {
    const stream = await window.api.play(variantId, se, ep);
    if (token !== playToken) return;
    if (!stream) {
      playerStatus.textContent = 'No playable stream for this title.';
      return;
    }
    await player.load(stream, {
      startTime,
      variants: card.variants || [],
      selectedVariantId: variantId,
      onSelectVariant: (id) => {
        current.variantId = id;
        loadCurrent(video.currentTime || 0);
      },
      episodes: isSeries ? buildEpisodes() : [],
      currentSe: se,
      currentEp: ep,
      onSelectEpisode: (s, e) => onPlayerEpisode(s, e),
    });
    if (token !== playToken) return;
    playerStatus.textContent = '';

    // Track progress every 5 seconds
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      const dur = video.duration || 0;
      const pos = video.currentTime || 0;
      if (dur > 0 && pos > 0 && current) {
        const subjectId = current.card.subjectId;
        recordProgress(
          {
            subjectId: current.card.subjectId,
            subjectType: current.card.subjectType || (current.isSeries ? 2 : 1),
            title: current.card.title,
            cover: { url: current.card.posterUrl },
            releaseDate: current.card.year ? `${current.card.year}-01-01` : '',
            duration: current.card.duration || '',
            imdbRatingValue: current.card.rating ? String(current.card.rating) : '',
            hasResource: true,
          },
          current.se,
          current.ep,
          Math.round(pos * 1000),
          Math.round(dur * 1000),
        );
      }
    }, 5000);

    window.api
      .captions(variantId, stream.se, stream.ep)
      .then((caps) => {
        if (token === playToken) player.setCaptions(caps);
      })
      .catch(() => {});
  } catch (err) {
    if (token === playToken) playerStatus.textContent = `Playback failed: ${err.message}`;
  }
}

function onPlayerEpisode(se, ep) {
  if (!current?.isSeries) return;
  current.se = se;
  current.ep = ep;
  highlightEpisode();
  showNowPlaying(current.card, { se, ep });
  loadCurrent(0);
}

window.onPlayerError = (detail) => {
  const code = detail?.code;
  if (code === 4032) {
    playerStatus.textContent =
      'This title is HEVC/H.265 and your Mac can\'t decode it (needs an HEVC-capable GPU).';
  } else {
    playerStatus.textContent = `Player error ${code ?? ''}: ${detail?.message || 'playback failed'}`;
  }
};

// --- back button ------------------------------------------------------------

backBtn.addEventListener('click', onBack);

function saveFinalProgress() {
  if (!current) return;
  const dur = video.duration || 0;
  const pos = video.currentTime || 0;
  if (dur > 0 && pos > 0) {
    recordProgress(
      {
        subjectId: current.card.subjectId,
        subjectType: current.card.subjectType || (current.isSeries ? 2 : 1),
        title: current.card.title,
        cover: { url: current.card.posterUrl },
        releaseDate: current.card.year ? `${current.card.year}-01-01` : '',
        duration: current.card.duration || '',
        imdbRatingValue: current.card.rating ? String(current.card.rating) : '',
        hasResource: true,
      },
      current.se,
      current.ep,
      Math.round(pos * 1000),
      Math.round(dur * 1000),
    );
  }
}

function onBack() {
  saveFinalProgress();
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  player.unload().catch(() => {});
  showPlayer(false);
  showHomeContent(true);
  clearActive();
  hideNowPlaying();
  current = null;
  status.textContent = '';
  playToken++;
  // Remove carousel-added result item from sidebar
  if (carouselResultItem) {
    carouselResultItem.remove();
    carouselResultItem = null;
  }
}

// Save progress before closing
window.addEventListener('beforeunload', saveFinalProgress);

// --- player / home visibility -----------------------------------------------

function showPlayer(show) {
  overlay.classList.toggle('hidden', !show);
  if (show) {
    homeContent.classList.add('hidden');
  }
}

function showHomeContent(show) {
  homeContent.classList.toggle('hidden', !show);
  if (show) {
    overlay.classList.add('hidden');
  }
}

// --- back button visibility in fullscreen -----------------------------------

function updateBackBtn() {
  backBtn.style.display = document.fullscreenElement ? 'none' : '';
}

document.addEventListener('fullscreenchange', updateBackBtn);

// --- init --------------------------------------------------------------------

loadHomeFeed();