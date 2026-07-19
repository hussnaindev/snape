// Renderer: sidebar search -> results (one per row, chip cards) -> play in the
// right pane. Series rows expand to Season/Episode selectors; the player shows
// an in-player episode selector too. All MovieBox calls go through window.api.

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerStatus = document.getElementById('player-status');
const idle = document.getElementById('idle');

const player = window.createStreamPlayer(video, overlay);
let searchSeq = 0;
let playToken = 0;

// The thing currently playing (drives episode switching + the player overlay).
let current = null; // { card, variantId, isSeries, seasons, seasonIdx, se, ep, panel }

// --- search -----------------------------------------------------------------

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
    if (seq !== searchSeq) return; // a newer search superseded this one
    renderResults(cards);
    status.textContent = cards.length ? '' : 'No results.';
  } catch (err) {
    if (seq !== searchSeq) return;
    results.innerHTML = '';
    status.textContent = `Search failed: ${err.message}`;
  }
}

function renderResults(cards) {
  results.innerHTML = '';
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
    startMovie(card);
    return;
  }
  // Series: accordion expand + load seasons, then auto-play S1E1.
  const panel = item.querySelector('.series-panel');
  const wasOpen = !panel.classList.contains('hidden');
  clearActive();
  if (wasOpen) return; // toggle closed
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
  // Auto-play the first episode of the first season.
  startEpisode(card, panel, seasons, 0, seasons[0].se, 1);
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
    b.addEventListener('click', () =>
      startEpisode(card, panel, seasons, seasonIdx, season.se, Number(b.dataset.ep)),
    ),
  );
}

// --- playback ---------------------------------------------------------------

function startMovie(card) {
  idle.classList.add('hidden');
  current = {
    card,
    variantId: card.variants?.[0]?.id || card.subjectId,
    isSeries: false,
    se: 0,
    ep: 0,
  };
  loadCurrent(0);
}

function startEpisode(card, panel, seasons, seasonIdx, se, ep) {
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
  loadCurrent(0);
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

// Episode picked from the in-player overlay (same season).
function onPlayerEpisode(se, ep) {
  if (!current?.isSeries) return;
  current.se = se;
  current.ep = ep;
  highlightEpisode();
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
