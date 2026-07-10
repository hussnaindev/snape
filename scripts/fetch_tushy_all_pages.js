(async () => {
  const HASH = 'NXp9CiAWKhohOLkjWB5YV';
  const TOTAL_PAGES = 57;
  const BASE = `https://www.tushy.com/_next/data/${HASH}/videos.json?page=`;

  const allEdges = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = BASE + page;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Page ${page}: HTTP ${resp.status}`);
        continue;
      }
      const json = await resp.json();
      const edges = json?.pageProps?.videos?.edges ?? [];
      allEdges.push(...edges);
      console.log(`Page ${page}: +${edges.length} videos (total ${allEdges.length})`);
    } catch (e) {
      console.error(`Page ${page}: ${e.message}`);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalCount: allEdges.length,
    videos: allEdges,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tushy_all_videos.json';
  a.click();
  URL.revokeObjectURL(a.href);

  console.log('DONE! Downloaded as tushy_all_videos.json');
  console.log(`Total videos: ${allEdges.length}`);
})();
