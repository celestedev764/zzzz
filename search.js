// Vercel Serverless Function — busca no YouTube sem API key (scraper via InnerTube + fallback HTML)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CV = '2.20250101.00.00';
const ID = /^[\w-]{11}$/;
const txt = o => !o ? '' : (o.simpleText ?? (o.runs || []).map(r => r.text).join(''));

function collect(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) collect(n, out); return; }
  for (const k in node) {
    const v = node[k];
    if (k === 'videoRenderer' && v?.videoId) { out.items.push(v); continue; }
    if (k === 'continuationCommand' && v?.token) { out.next = v.token; continue; }
    collect(v, out);
  }
}

function map(v) {
  if (!ID.test(v.videoId)) return null;
  const duration = txt(v.lengthText);
  if (!duration) return null; // ignora lives
  return {
    id: v.videoId,
    title: txt(v.title).slice(0, 200),
    artist: txt(v.ownerText || v.longBylineText || v.shortBylineText).slice(0, 120),
    duration,
    views: txt(v.shortViewCountText).slice(0, 40),
  };
}

async function innertube(body) {
  const r = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9',
      'x-youtube-client-name': '1', 'x-youtube-client-version': CV, origin: 'https://www.youtube.com',
    },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: CV, hl: 'pt', gl: 'BR' } }, ...body }),
  });
  if (!r.ok) throw new Error('innertube ' + r.status);
  return r.json();
}

async function scrapeHtml(q) {
  const r = await fetch('https://www.youtube.com/results?hl=pt&gl=BR&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q), {
    headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  });
  const h = await r.text();
  const m = h.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) throw new Error('parse');
  return JSON.parse(m[1]);
}

export default async function handler(req, res) {
  const q = String(req.query?.q || '').trim().slice(0, 150);
  const c = String(req.query?.c || '').slice(0, 4000);
  if (!q && !c) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });
  try {
    const out = { items: [], next: null };
    try { collect(await innertube(c ? { continuation: c } : { query: q, params: 'EgIQAQ%3D%3D' }), out); }
    catch (e) { if (c) throw e; }
    if (!out.items.length && !c) collect(await scrapeHtml(q), out);
    const seen = new Set();
    const items = out.items.map(map).filter(t => t && !seen.has(t.id) && seen.add(t.id));
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json({ items, next: items.length ? out.next : null });
  } catch (e) {
    res.status(502).json({ error: 'Não consegui buscar no YouTube agora. Tente de novo.' });
  }
}
