// Rendert ein Post-Artboard (.dc.html) zu einem 1080x1350-JPEG.
// Aufruf: node render.js <eingabe.dc.html> <ausgabe.jpg>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: node render.js in.dc.html out.jpg'); process.exit(2); }
  const s = fs.readFileSync(src, 'utf8');
  const m = s.match(/<\/helmet>\n?([\s\S]*)<\/x-dc>/);
  if (!m) throw new Error('Kein <x-dc>-Inhalt gefunden');
  let body = m[1];
  const accent = (s.match(/"accent":\{[^}]*"default":"(#[0-9A-Fa-f]{6})"/) || [])[1] || '#C6FF3D';
  const loop = body.match(/<sc-for[^>]*>\n?([\s\S]*?)<\/sc-for>\n?/);
  if (loop) {
    const rows = [...s.matchAll(/\{\s*loss:\s*'([^']*)',\s*gain:\s*'([^']*)'\s*\}/g)];
    if (!rows.length) throw new Error('Keine rows gefunden');
    body = body.replace(loop[0], rows.map(r => loop[1].replace(/\{\{row\.loss\}\}/g, r[1]).replace(/\{\{row\.gain\}\}/g, r[2])).join(''));
  }
  body = body.replace(/\{\{accent\}\}/g, accent);
  const left = body.match(/\{\{[^}]+\}\}/);
  if (left) throw new Error('Unaufgelöster Platzhalter: ' + left[0]);
  const fd = path.join(__dirname, 'fonts');
  const ff = [500, 700, 800, 900].map(w => `@font-face{font-family:'Archivo';font-weight:${w};src:url('file://${fd}/archivo-latin-${w}-normal.woff2')}`).join('');
  const tmp = path.join(require('os').tmpdir(), 'jt-render-' + Date.now() + '.html');
  fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>body{margin:0}${ff}</style>` + body);
  let b;
  try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + tmp);
  await p.waitForTimeout(500);
  const overflow = await p.evaluate(() => { const r = document.body.firstElementChild; return r.scrollHeight - r.clientHeight; });
  await p.screenshot({ path: out, type: 'jpeg', quality: 92 });
  await b.close(); fs.unlinkSync(tmp);
  console.log(JSON.stringify({ out, overflowPx: overflow }));
})().catch(e => { console.error(e.message); process.exit(1); });
