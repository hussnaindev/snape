// Renderer. A Netflix-style single-pane layout:
//  - A fixed top bar: brand, section quick-links, and a search field.
//  - A content area that swaps between the home rows, a search-results grid, a
//    per-category "see all" grid, and the player.
// Every tile is the same card shape search produces, so a single startCard()
// drives playback from anywhere (home card, search result, see-all grid). All
// MovieBox calls go through window.api.

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const searchIco = document.getElementById('search-ico');
const topbar = document.getElementById('topbar');
const brand = document.getElementById('brand');
const navLinks = document.getElementById('nav-links');

const homeView = document.getElementById('home-view');
const homeSections = document.getElementById('home-sections');
const homeStatus = document.getElementById('home-status');

const searchView = document.getElementById('search-view');
const searchGrid = document.getElementById('search-grid');
const searchTitle = document.getElementById('search-title');
const status = document.getElementById('status');

const seeallView = document.getElementById('seeall-view');
const seeallGrid = document.getElementById('seeall-grid');
const seeallTitle = document.getElementById('seeall-title');
const seeallBack = document.getElementById('seeall-back');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerView = document.getElementById('player-view');
const playerBack = document.getElementById('player-back');
const playerStatus = document.getElementById('player-status');

const player = window.createStreamPlayer(video, overlay);
let searchSeq = 0;
let playToken = 0;

// The thing currently playing (drives episode switching + the player overlay).
let current = null; // { card, variantId, isSeries, seasons, seasonIdx, se, ep }

// The most recent home categories, kept so nav links can scroll to a section.
let homeCats = [];

// --- content views -----------------------------------------------------------

function showView(name) {
  homeView.classList.toggle('hidden', name !== 'home');
  searchView.classList.toggle('hidden', name !== 'search');
  seeallView.classList.toggle('hidden', name !== 'seeall');
  playerView.classList.toggle('hidden', name !== 'player');
  // The top bar rides over the browse views, but not the player.
  topbar.classList.toggle('hidden', name === 'player');
}

function showPlayer() {
  showView('player');
}

// Leave the player: stop the stream and return to whichever browse view we came
// from (search grid, see-all grid, else home).
async function leavePlayer() {
  playToken++; // cancel any in-flight load
  current = null;
  playerStatus.textContent = '';
  await player.unload().catch(() => {});
  if (searchGrid.childElementCount) showView('search');
  else if (seeallGrid.childElementCount) showView('seeall');
  else showView('home');
}
playerBack.addEventListener('click', leavePlayer);
seeallBack.addEventListener('click', () => showView('home'));

// Reset to the home screen: stop any stream, clear search + see-all state.
async function goHome() {
  playToken++; // cancel any in-flight load
  current = null;
  playerStatus.textContent = '';
  await player.unload().catch(() => {});
  input.value = '';
  searchSeq++; // discard any in-flight search
  searchGrid.innerHTML = '';
  status.textContent = '';
  seeallGrid.innerHTML = '';
  showView('home');
  activeBrowseView()?.scrollTo({ top: 0 });
}
brand.addEventListener('click', goHome);

// --- home screen -------------------------------------------------------------

async function loadHome() {
  homeStatus.textContent = 'Loading…';
  try {
    const cats = await window.api.home();
    if (!cats.length) {
      homeStatus.textContent = 'Nothing to show right now.';
      return;
    }
    homeCats = cats;
    homeStatus.textContent = '';
    homeSections.innerHTML = '';
    for (const cat of cats) homeSections.appendChild(renderSection(cat));
    renderNavLinks(cats);
  } catch (err) {
    homeStatus.textContent = `Couldn’t load home: ${err.message}`;
  }
}

const CAROUSEL_MAX = 12;

function renderSection(cat) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = `sec-${cat.key}`;

  const head = document.createElement('div');
  head.className = 'section-head';
  const h = document.createElement('h2');
  h.className = 'section-title';
  h.textContent = cat.label;
  head.appendChild(h);
  if (cat.cards.length > CAROUSEL_MAX) {
    const more = document.createElement('button');
    more.className = 'see-all';
    more.textContent = 'See all ›';
    more.addEventListener('click', () => openSeeAll(cat));
    head.appendChild(more);
  }
  section.appendChild(head);

  // Scrolling carousel with hover arrows.
  const wrap = document.createElement('div');
  wrap.className = 'row-wrap';
  const row = document.createElement('div');
  row.className = 'carousel';
  for (const card of cat.cards.slice(0, CAROUSEL_MAX)) row.appendChild(posterCard(card));

  const prev = arrowButton('prev', '‹', row);
  const next = arrowButton('next', '›', row);
  wrap.append(prev, row, next);
  section.appendChild(wrap);

  // Toggle arrow visibility at the ends of the scroll range. The layout reads
  // are batched into a rAF so a fast scroll doesn't force reflow on every event.
  let syncQueued = false;
  const sync = () => {
    syncQueued = false;
    prev.disabled = row.scrollLeft <= 4;
    next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  };
  row.addEventListener(
    'scroll',
    () => {
      if (syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(sync);
    },
    { passive: true },
  );
  requestAnimationFrame(sync);
  return section;
}

function arrowButton(dir, glyph, row) {
  const b = document.createElement('button');
  b.className = `row-arrow ${dir}`;
  b.textContent = glyph;
  b.setAttribute('aria-label', dir === 'prev' ? 'Scroll left' : 'Scroll right');
  b.addEventListener('click', () => {
    row.scrollBy({ left: (dir === 'prev' ? -1 : 1) * row.clientWidth * 0.85 });
  });
  return b;
}

// A Netflix-style card: clean art at rest, hover reveals title/meta + a play
// button. Used everywhere (carousels, search grid, see-all grid).
const PLAY_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

function posterCard(card) {
  const btn = document.createElement('button');
  btn.className = 'card';
  const meta = [
    card.rating ? `<span class="c-rating">★ ${card.rating.toFixed(1)}</span>` : '',
    card.year ? `<span>${card.year}</span>` : '',
    card.isSeries ? '<span>Series</span>' : card.duration ? `<span>${card.duration}</span>` : '',
  ]
    .filter(Boolean)
    .join('<span class="dot">•</span>');
  btn.innerHTML = `
    <div class="card-art">
      ${card.posterUrl ? `<img loading="lazy" decoding="async" src="${card.posterUrl}" alt="">` : ''}
      ${card.isSeries ? '<span class="tag">SERIES</span>' : ''}
      <div class="card-hover">
        <span class="play">${PLAY_SVG}</span>
        <div class="c-title"></div>
        <div class="c-meta">${meta}</div>
      </div>
    </div>`;
  btn.querySelector('.c-title').textContent = card.title;
  btn.addEventListener('click', () => startCard(card));
  return btn;
}

// --- top-bar section links ---------------------------------------------------

function renderNavLinks(cats) {
  navLinks.innerHTML = '';
  const home = document.createElement('button');
  home.className = 'nav-link';
  home.textContent = 'Home';
  home.addEventListener('click', goHome);
  navLinks.appendChild(home);

  for (const cat of cats) {
    const b = document.createElement('button');
    b.className = 'nav-link';
    b.textContent = cat.label;
    b.addEventListener('click', () => jumpToSection(cat.key));
    navLinks.appendChild(b);
  }
}

async function jumpToSection(key) {
  if (!homeView.classList.contains('hidden')) {
    // already home
  } else {
    await goHome();
  }
  document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- see all (per-category grid) ---------------------------------------------

// "See all" shows the category's entire pool at once. The grid items each carry
// content-visibility so the offscreen rows still skip layout/paint work.
function openSeeAll(cat) {
  seeallTitle.textContent = cat.label;
  seeallGrid.innerHTML = '';
  seeallView.scrollTop = 0;
  const frag = document.createDocumentFragment();
  for (const card of cat.cards) frag.appendChild(posterCard(card));
  seeallGrid.appendChild(frag);
  showView('seeall');
}

// --- top-bar scroll state ----------------------------------------------------

// Solidify the top bar once the active browse view is scrolled.
function activeBrowseView() {
  for (const v of [homeView, searchView, seeallView]) {
    if (!v.classList.contains('hidden')) return v;
  }
  return null;
}
for (const v of [homeView, searchView, seeallView]) {
  v.addEventListener('scroll', () => topbar.classList.toggle('scrolled', v.scrollTop > 10), {
    passive: true,
  });
}

// --- search ------------------------------------------------------------------

// The magnifier glyph isn't a real submit control, so clicking it did nothing
// while the field was collapsed. Focus the input so the field expands and the
// user can type (and re-run the current search on click when text is present).
searchIco?.addEventListener('click', () => {
  input.focus();
  if (input.value.trim()) runSearch();
});

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
    goHome(); // clearing the search box returns to the home screen
    return;
  }
  searchTitle.textContent = `Results for “${keyword}”`;
  status.textContent = 'Searching…';
  searchGrid.innerHTML = '';
  showView('search');
  searchView.scrollTop = 0;
  try {
    const cards = await window.api.search(keyword);
    if (seq !== searchSeq) return; // a newer search superseded this one
    searchGrid.innerHTML = '';
    for (const c of cards) searchGrid.appendChild(posterCard(c));
    status.textContent = cards.length ? '' : 'No results.';
  } catch (err) {
    if (seq !== searchSeq) return;
    searchGrid.innerHTML = '';
    status.textContent = `Search failed: ${err.message}`;
  }
}

// --- playback ----------------------------------------------------------------

// Unified entry from any card. Movies play directly; series load their seasons
// then start at S1E1 with the in-player episode strip.
async function startCard(card) {
  if (!card.isSeries) {
    startMovie(card);
    return;
  }
  showPlayer();
  playerStatus.textContent = 'Loading…';
  const seasons = card._seasons || (await window.api.seasons(card.subjectId).catch(() => []));
  card._seasons = seasons;
  if (!seasons.length) {
    startMovie(card); // no season info -> try it as a single (se=0) title
    return;
  }
  startEpisode(card, seasons, seasons[0].se, 1);
}

function startMovie(card) {
  showPlayer();
  current = {
    card,
    variantId: card.variants?.[0]?.id || card.subjectId,
    isSeries: false,
    se: 0,
    ep: 0,
  };
  loadCurrent(0);
}

function startEpisode(card, seasons, se, ep) {
  showPlayer();
  current = {
    card,
    seasons,
    variantId: card.variants?.[0]?.id || card.subjectId,
    isSeries: true,
    se,
    ep,
  };
  loadCurrent(0);
}

// Flatten every season into one episode list for the in-player strip. A
// multi-season title labels cells "S1·E1" so season switching works in-player;
// a single-season title keeps the terse "E1".
function buildEpisodes() {
  if (!current?.isSeries || !current.seasons?.length) return [];
  const multi = current.seasons.length > 1;
  return current.seasons.flatMap((s) =>
    Array.from({ length: s.maxEp }, (_, i) => ({
      se: s.se,
      ep: i + 1,
      label: multi ? `S${s.se}·E${i + 1}` : `E${i + 1}`,
    })),
  );
}

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

// Episode picked from the in-player overlay.
function onPlayerEpisode(se, ep) {
  if (!current?.isSeries) return;
  current.se = se;
  current.ep = ep;
  loadCurrent(0);
}

// Shaka error 4032 = CONTENT_UNSUPPORTED_BY_BROWSER — for these HEVC-only
// streams it means this Mac has no usable HEVC hardware decoder.
window.onPlayerError = (detail) => {
  const code = detail?.code;
  if (code === 4032) {
    playerStatus.textContent =
      'This title is HEVC/H.265 and your Mac can’t decode it (needs an HEVC-capable GPU).';
  } else {
    playerStatus.textContent = `Player error ${code ?? ''}: ${detail?.message || 'playback failed'}`;
  }
};

// Kick off the home screen on startup.
loadHome();
