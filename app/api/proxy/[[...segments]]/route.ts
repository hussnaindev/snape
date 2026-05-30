export const runtime = 'edge';

function base64urlDecode(s: string): string {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return atob(padded);
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
