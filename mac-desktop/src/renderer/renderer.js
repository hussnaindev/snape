// Renderer: search box -> result cards -> click a card -> the custom player
// (player.js, a port of the Android StreamPlayerChrome) plays the DASH stream.
// All MovieBox calls go through window.api (main process).

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerTitle = document.getElementById('player-title');
const playerStatus = document.getElementById('player-status');
document.getElementById('player-close').addEventListener('click', closePlayer);

const player = window.createStreamPlayer(video, overlay);
let searchSeq = 0;
let playToken = 0;

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
    renderCards(cards);
    status.textContent = cards.length ? '' : 'No results.';
  } catch (err) {
    if (seq !== searchSeq) return;
    results.innerHTML = '';
    status.textContent = `Search failed: ${err.message}`;
  }
}

function renderCards(cards) {
  results.innerHTML = '';
  for (const c of cards) {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `
      <div class="poster">
        ${c.posterUrl ? `<img loading="lazy" src="${c.posterUrl}" alt="">` : ''}
        <span class="badge">${c.isSeries ? 'Series' : 'Movie'}</span>
        ${c.rating ? `<span class="badge rating">★ ${c.rating.toFixed(1)}</span>` : ''}
      </div>
      <div class="meta">
        <div class="title"></div>
        <div class="sub">${[c.year, c.isSeries ? 'Series' : c.duration].filter(Boolean).join(' · ')}</div>
      </div>`;
    card.querySelector('.title').textContent = c.title;
    card.addEventListener('click', () => playCard(c));
    results.appendChild(card);
  }
}

// --- playback ---------------------------------------------------------------

async function playCard(card) {
  openPlayer(card.title);
  // Default audio variant = the card's primary (first in the variants list).
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

function openPlayer(title) {
  playerTitle.textContent = title;
  overlay.classList.remove('hidden');
}

async function closePlayer() {
  playToken++;
  overlay.classList.add('hidden');
  video.pause();
  await player.unload();
  playerStatus.textContent = '';
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
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
    if (document.fullscreenElement) return; // let Esc exit fullscreen first
    closePlayer();
  }
});
