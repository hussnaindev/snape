export const runtime = 'edge';

function base64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function toProxyPath(raw: string): string {
  const lastSlash = raw.lastIndexOf('/');
  const base = lastSlash >= 0 ? raw.slice(0, lastSlash + 1) : raw + '/';
  const file = lastSlash >= 0 ? raw.slice(lastSlash + 1) : '';
  return `/api/proxy/${base64urlEncode(base)}${file ? `/${file}` : ''}`;
}

function isM3U8(contentType: string, url: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('x-mpegurl')) return true;
  const path = url.split('?')[0]!.toLowerCase();
  return path.endsWith('.m3u8') || path.endsWith('.m3u');
}

// Rewrite absolute URLs inside an M3U8 manifest so hls.js always fetches
// segments and sub-playlists through this proxy, avoiding mixed-content and
// CORS failures in the browser.
function rewriteM3U8(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA…)
        return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return `URI="${toProxyPath(uri)}"`;
          }
          return `URI="${uri}"`;
        });
      }

      // Plain URL lines — segment or variant-playlist
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return toProxyPath(trimmed);
      }

      return line;
    })
    .join('\n');
}

export async function GET(request: Request) {
  try {
    const { pathname, search } = new URL(request.url);
    const parts = pathname.split('/').filter(Boolean);
    // parts[0] = api, parts[1] = proxy, parts[2] = base64url-base, rest = relative path
    if (parts.length < 3) {
      return new Response('Invalid path', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const encodedBase = parts[2]!;
    const relativePath = parts.slice(3).join('/');

    let baseUrl: string;
    try {
      baseUrl = base64urlDecode(encodedBase);
    } catch {
      return new Response('Invalid base64 encoding', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (!baseUrl.endsWith('/')) baseUrl += '/';
    const targetUrl = relativePath ? `${baseUrl}${relativePath}${search}` : baseUrl.slice(0, -1);

    const resp = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!resp.ok) {
      return new Response(await resp.text(), {
        status: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const contentType = resp.headers.get('content-type') ?? '';

    if (isM3U8(contentType, targetUrl)) {
      const text = await resp.text();
      const rewritten = rewriteM3U8(text);
      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': contentType || 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          // Live manifests must not be cached — hls.js polls them every few seconds
          'Cache-Control': 'no-store',
        },
      });
    }

    const body = await resp.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch {
    return new Response('Proxy error', {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
