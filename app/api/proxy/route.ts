export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return new Response('Missing url parameter', { status: 400 });
    }

    const decoded = decodeURIComponent(url);

    const resp = await fetch(decoded, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!resp.ok) {
      return new Response(await resp.text(), {
        status: resp.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    const contentType = resp.headers.get('content-type') ?? '';
    const isM3U = decoded.includes('.m3u') || contentType.includes('mpegurl') || contentType.includes('m3u');

    if (isM3U) {
      const text = await resp.text();
      const baseUrl = new URL(decoded);
      const proxyBase = '/api/proxy?url=';

      const rewritten = text.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        try {
          const absolute = new URL(trimmed, baseUrl).href;
          return `${proxyBase}${encodeURIComponent(absolute)}`;
        } catch {
          return line;
        }
      }).join('\n');

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'public, max-age=30',
        },
      });
    }

    const blob = await resp.blob();

    return new Response(blob, {
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
