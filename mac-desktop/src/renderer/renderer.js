// Renderer: search box -> result cards -> click a card -> Shaka plays the DASH
// stream. All MovieBox calls go through window.api (main process).

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('video');
const playerTitle = document.getElementById('player-title');
const playerStatus = document.getElementById('player-status');
document.getElementById('player-close').addEventListener('click', closePlayer);

let player = null;
let searchSeq = 0;

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
    card.addEventListener('click', () => play(c));
    results.appendChild(card);
  }
}

// --- playback ---------------------------------------------------------------

async function play(card) {
  openPlayer(card.title);
  playerStatus.textContent = 'Loading stream…';
  try {
    const stream = await window.api.play(card.subjectId, card.isSeries);
    if (!stream) {
      playerStatus.textContent = 'No playable stream for this title.';
      return;
    }
    await loadStream(stream);
    playerStatus.textContent = '';
  } catch (err) {
    playerStatus.textContent = `Playback failed: ${err.message}`;
  }
}

async function loadStream(stream) {
  if (!player) {
    shaka.polyfill.installAll();
    player = new shaka.Player(video);
    player.addEventListener('error', (e) => onPlayerError(e.detail));

    // Some MovieBox manifests declare a BARE HEVC codec (codecs="hev1") with no
    // profile/level. MediaSource.isTypeSupported() rejects a bare string even
    // when HEVC decoding works, so Shaka fails with 4032 CONTENT_UNSUPPORTED.
    // Patch the manifest to add a Main-profile / level-4.0 descriptor (covers up
    // to 1080p) so it's accepted; full codec strings are left untouched.
    player
      .getNetworkingEngine()
      .registerResponseFilter((type, response) => {
        if (type !== shaka.net.NetworkingEngine.RequestType.MANIFEST) return;
        const text = new TextDecoder().decode(response.data);
        const patched = text.replace(/codecs="(hev1|hvc1)"/g, 'codecs="$1.1.6.L120.90"');
        if (patched !== text) response.data = new TextEncoder().encode(patched).buffer;
      });
  }
  // The main process injects the CloudFront cookie + UA on CDN requests, so
  // Shaka just loads the manifest URL directly.
  await player.load(stream.url);
  video.play().catch(() => {});
}

function openPlayer(title) {
  playerTitle.textContent = title;
  overlay.classList.remove('hidden');
}

async function closePlayer() {
  overlay.classList.add('hidden');
  video.pause();
  if (player) {
    await player.unload().catch(() => {});
  }
  playerStatus.textContent = '';
}

// Shaka error 4032 = CONTENT_UNSUPPORTED_BY_BROWSER — for these HEVC-only
// streams it means this Mac has no usable HEVC hardware decoder.
function onPlayerError(detail) {
  const code = detail?.code;
  if (code === 4032) {
    playerStatus.textContent =
      'This title is HEVC/H.265 and your Mac can’t decode it (needs an HEVC-capable GPU).';
  } else {
    playerStatus.textContent = `Player error ${code ?? ''}: ${detail?.message || 'playback failed'}`;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closePlayer();
});
