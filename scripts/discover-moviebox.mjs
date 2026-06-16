import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ProxyAgent, fetch as uFetch } from 'undici';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const MOBILE_API = 'https://api.inmoviebox.com/wefeed-mobile-bff';
const MOBILE_SEARCH_PATH = '/wefeed-mobile-bff/subject-api/search';
const MOBILE_SECRET_KEY = process.env.MOVIEBOX_SECRET_KEY?.trim() || '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O';
const TARGET_WORDS = new Set([
  'tushy', 'blacked', 'vixen', 'blackedraw', 'tushyraw',
  'slayed', 'milfy', 'wifey', 'deeper',
]);
const SEARCH_PAGES_PER_TITLE = 5;
const MAX_TOTAL_SEARCHES = 2000;
const SAVE_INTERVAL = 20;
const RESULTS_FILE = 'scripts/moviebox-results.json';

const PROXY_LIST = (process.env.PROXY_LIST ?? '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

// --- Signing helpers ----------------------------------------------------------
function b64DecodeKey(v) { return Buffer.from(v, 'base64'); }
function md5Hex(b) { return createHash('md5').update(b).digest('hex'); }
function xClientToken(ts) {
  const s = String(ts);
  return `${s},${md5Hex(Buffer.from([...s].reverse().join(''), 'utf8'))}`;
}
function xTrSignature(path, body, ts) {
  const bb = Buffer.from(body, 'utf8');
  const bh = md5Hex(bb.subarray(0, 102400));
  const c = ['POST','application/json','application/json',String(bb.length),String(ts),bh,path].join('\n');
  const mac = createHmac('md5', b64DecodeKey(MOBILE_SECRET_KEY)).update(c, 'utf8').digest('base64');
  return `${ts}|2|${mac}`;
}
function mobileClientInfo() {
  return JSON.stringify({
    package_name:'com.community.oneroom',version_name:'3.0.03.0529.03',
    version_code:50020044,os:'android',os_version:'13',install_ch:'ps',
    device_id:randomBytes(16).toString('hex'),install_store:'ps',
    gaid:randomUUID(),brand:'Redmi',model:'23078RKD5C',
    system_language:'en',net:'NETWORK_WIFI',region:'US',
    timezone:'America/New_York',sp_code:'40401','X-Play-Mode':'2',
  });
}
const MOBILE_UA='com.community.oneroom/50020044 (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)';
function pickProxyAgent() {
  if (PROXY_LIST.length===0) return undefined;
  const e=PROXY_LIST[Math.floor(Math.random()*PROXY_LIST.length)];
  const [h,p,u,pass]=e.split(':');
  if (!h||!p) return undefined;
  const a=u&&pass?`${encodeURIComponent(u)}:${encodeURIComponent(pass)}@`: '';
  return new ProxyAgent(`http://${a}${h}:${p}`);
}

async function mobileSearch(keyword, subjectType, page=1) {
  const body=JSON.stringify({keyword,page,perPage:20,subjectType});
  const ts=Date.now();
  const res=await uFetch(`${MOBILE_API}/subject-api/search`,{
    method:'POST',
    headers:{
      Accept:'application/json',Connection:'keep-alive',
      'Content-Type':'application/json','User-Agent':MOBILE_UA,
      'X-Client-Info':mobileClientInfo(),'X-Client-Status':'0',
      'X-Client-Token':xClientToken(ts),
      'x-tr-signature':xTrSignature(MOBILE_SEARCH_PATH,body,ts),
    },body,dispatcher:pickProxyAgent(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j=await res.json();
  if (j.code!==0) throw new Error(`API ${j.code}`);
  return j.data;
}

function getFirstWord(t) { return (t||'').trim().split(/\s+/)[0].toLowerCase(); }
function isMatch(item) { return TARGET_WORDS.has(getFirstWord(item.title)); }

function save(known, searchedTitles) {
  const matches=[...known.values()].sort((a,b)=>a.title.localeCompare(b.title));
  writeFileSync(RESULTS_FILE, JSON.stringify({
    generatedAt:new Date().toISOString(),targetStudios:[...TARGET_WORDS],
    totalMatches:matches.length,matches,
    searchedTitles:[...searchedTitles],
  },null,2));
}

async function main() {
  console.log(`=== MovieBox Discovery (BFS, max ${MAX_TOTAL_SEARCHES} searches) ===`);

  // Load or init; backfill missing fields for legacy entries
  const known=new Map();
  const searchedTitles=new Set();
  if (existsSync(RESULTS_FILE)) {
    const existing=JSON.parse(readFileSync(RESULTS_FILE,'utf-8'));
    for (const m of existing.matches) {
      if (m.hasResource === undefined) m.hasResource = true;
      if (m.coverUrl === undefined) m.coverUrl = null;
      known.set(String(m.subjectId),m);
    }
    if (existing.searchedTitles) {
      for (const t of existing.searchedTitles) searchedTitles.add(t);
    }
    console.log(`Loaded ${known.size} existing matches, ${searchedTitles.size} already searched`);
  }

  // Queue only titles not yet searched
  const queue=[];
  for (const m of known.values()) {
    if (!searchedTitles.has(m.title.toLowerCase())) queue.push(m.title);
  }
  console.log(`${queue.length} titles remaining to search`);

  let searchesDone=0;
  let newInRound=0;

  while (queue.length>0 && searchesDone<MAX_TOTAL_SEARCHES) {
    const title=queue.shift();
    if (searchedTitles.has(title.toLowerCase())) continue;

    for (const st of [1,2]) {
      const tLabel=st===1?'movies':'series';
      for (let p=1; p<=SEARCH_PAGES_PER_TITLE; p++) {
        if (searchesDone>=MAX_TOTAL_SEARCHES) break;
        let data;
        try {
          data=await mobileSearch(title,st,p);
          searchesDone++;
        } catch {
          break;
        }
        const items=data?.items??[];
        if (items.length===0) break;

        for (const item of items) {
          const id=String(item.subjectId);
          const hasResource = item.hasResource === true;
          if (!hasResource) continue;
          if (!isMatch(item)) continue;

          const coverUrl = item.cover?.url || null;

          if (known.has(id)) {
            // Fill in missing coverUrl for existing matches
            const existing = known.get(id);
            if (!existing.coverUrl && coverUrl) {
              existing.coverUrl = coverUrl;
              console.log(`  📷 [${id}] ${item.title}`);
            }
            continue;
          }

          known.set(id,{
            subjectId:id,title:item.title,postTitle:item.postTitle??null,
            releaseDate:item.releaseDate??null,subjectType:item.subjectType,
            duration:item.duration??item.durationSeconds??null,
            hasResource,coverUrl,
            discoveredBy:title,
          });
          const fw=getFirstWord(item.title);
          console.log(`  + ${fw.toUpperCase()} [${id}] ${item.title}`);
          // Queue new title for further searching
          if (!searchedTitles.has(item.title.toLowerCase())) {
            queue.push(item.title);
            searchedTitles.add(item.title.toLowerCase());
          }
          newInRound++;
        }
        if (items.length<20) break;
      }
      if (searchesDone>=MAX_TOTAL_SEARCHES) break;
    }
    searchedTitles.add(title.toLowerCase());

    // Periodic save
    if (newInRound>=SAVE_INTERVAL) {
      save(known, searchedTitles);
      console.log(`  [saved ${known.size} matches after ${searchesDone} searches]`);
      newInRound=0;
    }
  }

  // Final save
  save(known, searchedTitles);
  const byStudio={};
  for (const m of known.values()) {
    const s=getFirstWord(m.title);
    if (!byStudio[s]) byStudio[s]=[];
    byStudio[s].push(m);
  }
  console.log(`\n=== FINAL: ${known.size} unique matching titles (${searchesDone} searches) ===`);
  for (const [s,items] of Object.entries(byStudio).sort()) {
    console.log(`${s.toUpperCase()}: ${items.length}`);
  }
  console.log(`\nSaved to ${RESULTS_FILE}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
