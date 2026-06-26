// Renderer: sidebar search -> results (one per row) -> click a row -> the custom
// player (player.js, a port of the Android StreamPlayerChrome) plays the DASH
// stream in the right pane. All MovieBox calls go through window.api.

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerTitle = document.getElementById('player-title');
const playerStatus = document.getElementById('player-status');
const idle = document.getElementById('idle');

const player = window.createStreamPlayer(video, overlay);
let searchSeq = 0;
let playToken = 0;
let activeRow = null;

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
  activeRow = null;
  for (const c of cards) {
    const row = document.createElement('button');
    row.className = 'result';
    row.innerHTML = `
      <div class="thumb">${c.posterUrl ? `<img loading="lazy" src="${c.posterUrl}" alt="">` : ''}</div>
      <div class="info">
        <div class="r-title"></div>
        <div class="r-sub">
          ${[c.year, c.isSeries ? 'Series' : 'Movie'].filter(Boolean).join(' · ')}${
            c.rating ? ` · <span class="star">★ ${c.rating.toFixed(1)}</span>` : ''
          }
        </div>
      </div>`;
    row.querySelector('.r-title').textContent = c.title;
    row.addEventListener('click', () => {
      setActiveRow(row);
      playCard(c);
    });
    results.appendChild(row);
  }
}

function setActiveRow(row) {
  if (activeRow) activeRow.classList.remove('active');
  activeRow = row;
  row.classList.add('active');
}

// --- playback ---------------------------------------------------------------

async function playCard(card) {
  idle.classList.add('hidden');
  playerTitle.textContent = card.title;
  const variants = card.variants || [];
  const startId = variants[0]?.id || card.subjectId;
  await playVariant(card, startId);
}

async function playVariant(card, variantId, startTime = 0) {
  const token = ++playToken;
  playerStatus.textContent = 'Loading stream…';
  try {
    const stream = await window.api.play(variantId, card.isSeries);
    if (token !== playToken) return;
    if (!stream) {
      playerStatus.textContent = 'No playable stream for this title.';
      return;
    }
    await player.load(stream, {
      startTime,
      variants: card.variants || [],
      selectedVariantId: variantId,
      onSelectVariant: (id) => switchVariant(card, id),
    });
    if (token !== playToken) return;
    playerStatus.textContent = '';
    // Subtitles load best-effort in the background (like the app's detail VM).
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

// Switching audio variant refetches that variant's stream, preserving position.
function switchVariant(card, variantId) {
  playVariant(card, variantId, video.currentTime || 0);
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.fullscreenElement) {
    // let the browser exit fullscreen; keep playing in the pane
    return;
  }
});
