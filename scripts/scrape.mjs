// Daily scraper: fetches every league page once and writes data.json
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const ROOT = process.env.DARTS_ROOT || 'https://www.bullseyegames.com/league/darts/';
const UA = { 'User-Agent': 'DartStatsBullseye/1.0 (personal hobby project; one run per day)' };
const cl = s => (s || '').replace(/\s+/g, ' ').trim(), sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u) {
  let e;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (x) { e = x; await sleep(2000 * a); }
  }
  throw e;
}
function parse(html) {
  const d = new JSDOM(html).window.document;
  d.querySelectorAll('script,style').forEach(e => e.remove());
  let head = ''; const tabs = [], title = cl(d.querySelector('h1')?.textContent);
  d.querySelectorAll('h1,h2,h3,h4,h5,h6,table').forEach(e => {
    if (e.tagName !== 'TABLE') { if (!e.closest('table')) head = cl(e.textContent); return; }
    if (e.parentElement.closest('table')) return;
    const trs = [...e.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => cl(c.textContent)));
    if (trs.length < 2) return;
    // header row = first row naming Home and Away (schedule), else the first row
    let hi = trs.findIndex(r => r.some(c => /^home$/i.test(c)) && r.some(c => /^away$/i.test(c)));
    if (hi < 0) hi = 0;
    const hd = trs[hi];
    tabs.push({ heading: head, headers: hd, rows: trs.slice(hi + 1).filter(r => r.length === hd.length).map(r => Object.fromEntries(hd.map((k, i) => [k, r[i]]))) });
  });
  const iframes = [...d.querySelectorAll('iframe[src]')].map(i => i.getAttribute('src'));
  return { title, tabs, iframes };
}
const dir = new JSDOM(await get(ROOT)).window.document, set = new Set();
dir.querySelectorAll('a[href]').forEach(a => { try {
  const u = new URL(a.getAttribute('href'), ROOT);
  if (/^(www\.)?bullseyegames\.com$/.test(u.host) || u.host === new URL(ROOT).host)
    if (u.pathname.startsWith('/day-schedule/')) set.add(u.origin + u.pathname);
} catch {} });
const urls = [...set].sort();
if (!urls.length) { console.error('No league links found - layout changed?'); process.exit(1); }
const pages = [], errors = [];
for (const url of urls) {
  try {
    const { iframes, ...pg } = parse(await get(url));
    const embeds = [];
    for (const src of iframes.slice(0, 4)) {
      try {
        const eu = new URL(src, url);
        if (!/^https?:$/.test(eu.protocol) || /youtube|facebook|google\.com\/maps|doubleclick|twitter|instagram|vimeo/i.test(eu.href)) continue;
        await sleep(500);
        const em = parse(await get(eu.href));
        em.tabs.forEach(t => { if (t.headers.some(h => /^home$/i.test(h)) && t.headers.some(h => /^away$/i.test(h))) t.heading = 'League Schedule'; else t.heading = t.heading || 'Embedded table'; });
        pg.tabs.push(...em.tabs);
        embeds.push({ src: eu.href, tables: em.tabs.length });
      } catch (e) { embeds.push({ src, error: e.message }); }
    }
    pages.push({ url, ...pg, embeds }); console.log('ok', url, embeds.length ? JSON.stringify(embeds) : '');
  }
  catch (e) { errors.push(url + ': ' + e.message); console.error('FAIL', url, e.message); }
  await sleep(1000);
}
// Never overwrite good data with a mostly-failed run
if (pages.length < Math.ceil(urls.length * 0.8)) { console.error('Too many failures; keeping previous data.json'); process.exit(1); }
fs.writeFileSync('data.json', JSON.stringify({ generated: new Date().toISOString(), scanned: urls.length, errors, pages }));
console.log(`Wrote data.json: ${pages.length}/${urls.length} pages`);
