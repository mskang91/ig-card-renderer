const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

// 한글 폰트 로드 — 번들(fonts/ 폴더의 ttf/otf) 우선, 없으면 CDN fetch. 1회 캐시.
// TTF/OTF의 'name' 테이블에서 family 이름(nameID 1) 추출 — 진단용
function fontFamily(buf) {
  try {
    const numTables = buf.readUInt16BE(4);
    let nameTbl = 0;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (buf.toString('latin1', o, o + 4) === 'name') { nameTbl = buf.readUInt32BE(o + 8); break; }
    }
    if (!nameTbl) return null;
    const count = buf.readUInt16BE(nameTbl + 2);
    const strOff = nameTbl + buf.readUInt16BE(nameTbl + 4);
    let fallback = null;
    for (let i = 0; i < count; i++) {
      const r = nameTbl + 6 + i * 12;
      const pid = buf.readUInt16BE(r);
      const nameID = buf.readUInt16BE(r + 6);
      const len = buf.readUInt16BE(r + 8);
      const off = buf.readUInt16BE(r + 10);
      if (nameID === 1) {
        const s = buf.slice(strOff + off, strOff + off + len);
        const name = (pid === 3 || pid === 0) ? Buffer.from(s).swap16().toString('utf16le') : s.toString('latin1');
        if (pid === 3) return name;
        fallback = name;
      }
    }
    return fallback;
  } catch (e) { return 'err'; }
}

let _fonts = null;
let _fontDiag = [];
let _fontDir = null;
async function getFonts() {
  if (_fonts) return _fonts;
  const bufs = [];
  _fontDiag = [];
  const dirs = [
    path.join(process.cwd(), 'fonts'),
    path.join(__dirname, 'fonts'),
    path.join(__dirname, '..', 'fonts'),
    '/var/task/fonts'
  ];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => /\.(ttf|otf)$/i.test(f));
        _fontDiag.push(dir + ' => ' + files.length);
        for (const f of files) { try { bufs.push(fs.readFileSync(path.join(dir, f))); } catch (e) {} }
        if (bufs.length) { _fontDir = dir; break; }
      } else { _fontDiag.push(dir + ' => none'); }
    } catch (e) { _fontDiag.push(dir + ' => err ' + e.message); }
  }
  _fonts = bufs;
  return bufs;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const DEFS = `<defs>
<radialGradient id="bg" cx="22%" cy="12%" r="95%"><stop offset="0%" stop-color="#241653"/><stop offset="42%" stop-color="#100a2b"/><stop offset="100%" stop-color="#05050f"/></radialGradient>
<linearGradient id="violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient>
<linearGradient id="violet2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
<linearGradient id="mag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>
<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.45"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="softglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="26"/></filter>
</defs>`;

function head(q) {
  const sub = esc(q.sub || '');
  const h1 = esc(q.h1 || '');
  const h2 = esc(q.h2 || '');
  const h2acc = esc(q.h2acc || '');
  const date = esc(q.date || '');
  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard">
${DEFS}
<rect width="1080" height="1080" fill="url(#bg)"/>
<circle cx="250" cy="150" r="260" fill="#7c3aed" opacity="0.18" filter="url(#softglow)"/>
<circle cx="900" cy="700" r="220" fill="#8b5cf6" opacity="0.12" filter="url(#softglow)"/>
<g transform="translate(72,84)"><circle cx="14" cy="6" r="14" fill="url(#violet)"/><text x="42" y="14" fill="#ffffff" font-size="30" font-weight="700">polarisquant</text></g>
<text x="1008" y="98" text-anchor="end" fill="#9b93c4" font-size="26" font-weight="400">${date}</text>
<rect x="72" y="128" width="936" height="2" fill="#ffffff" opacity="0.08"/>
<text x="72" y="276" fill="#c4b5fd" font-size="32" font-weight="700" letter-spacing="3">${sub}</text>
<text x="72" y="360" fill="#ffffff" font-size="74" font-weight="700">${h1}</text>
<text x="72" y="448" fill="#ffffff" font-size="74" font-weight="700">${h2}<tspan fill="#a78bfa">${h2acc}</tspan></text>`;
}

function foot(q) {
  const unit = esc(q.unit || '');
  return `<rect x="72" y="1030" width="936" height="2" fill="#ffffff" opacity="0.06"/>
<text x="72" y="1066" fill="#7c76a3" font-size="25" font-weight="400">${unit}</text>
<text x="1008" y="1066" text-anchor="end" fill="#9b93c4" font-size="25" font-weight="700">@polarisquant · 데이터로 읽는 시장</text>
</svg>`;
}

function buildBar(q) {
  const labels = (q.labels || '외국인,기관,개인').split(',');
  const values = (q.values || '-6.95,1.81,5.02').split(',').map(Number);
  const maxAbs = Math.max.apply(null, values.map(Math.abs).concat([1]));
  const baseline = 770, maxBarH = 200, unit = maxBarH / maxAbs;
  const n = values.length, slotW = 840 / n, barW = Math.min(180, slotW * 0.62);
  let bars = '';
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const cx = 120 + slotW * (i + 0.5), x = cx - barW / 2;
    const h = Math.max(8, Math.abs(v) * unit);
    const y = v < 0 ? baseline : baseline - h;
    const fill = v < 0 ? 'url(#mag)' : (i % 2 === 1 ? 'url(#violet)' : 'url(#violet2)');
    const valY = v < 0 ? baseline - 20 : y - 20;
    const valColor = v < 0 ? '#f9a8d4' : '#ddd6fe';
    const valTxt = (v >= 0 ? '+' : '') + v;
    bars += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${barW.toFixed(0)}" height="${h.toFixed(0)}" rx="10" fill="${fill}" filter="url(#glow)"/>
<text x="${cx.toFixed(0)}" y="${valY.toFixed(0)}" text-anchor="middle" fill="${valColor}" font-size="40" font-weight="700">${esc(valTxt)}</text>
<text x="${cx.toFixed(0)}" y="1004" text-anchor="middle" fill="#cbd5e1" font-size="34" font-weight="700">${esc(labels[i])}</text>`;
  }
  return head(q) + `<line x1="120" y1="${baseline}" x2="960" y2="${baseline}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>` + bars + foot(q);
}

function scaleY(vals, yTop, yBot) {
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if (mx === mn) mx = mn + 1;
  return vals.map(function (v) { return yBot - (v - mn) / (mx - mn) * (yBot - yTop); });
}

function buildLine(q) {
  var vals = (q.vals || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
  if (vals.length < 2) vals = [1, 2, 1.5, 3, 2.5, 4];
  var x0 = 110, x1 = 970, yTop = 560, yBot = 900, n = vals.length;
  var ys = scaleY(vals, yTop, yBot);
  var pts = ys.map(function (y, i) { return (x0 + (x1 - x0) * i / (n - 1)).toFixed(0) + ',' + y.toFixed(0); });
  return head(q)
    + '<path d="M' + pts.join(' L') + ' L' + x1 + ',960 L' + x0 + ',960 Z" fill="url(#areaFill)"/>'
    + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="url(#violet)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>'
    + '<circle cx="' + x1 + '" cy="' + ys[n - 1].toFixed(0) + '" r="13" fill="#a78bfa" filter="url(#glow)"/>'
    + foot(q);
}

function buildArea(q) {
  var svg = buildLine(q);
  if (q.price) {
    var box = '<g transform="translate(700,520)"><rect x="0" y="0" width="280" height="74" rx="14" fill="#1c1442" stroke="#7c3aed" stroke-opacity="0.6" stroke-width="2"/><text x="24" y="48" fill="#ffffff" font-size="40" font-weight="700">' + esc(q.price) + '</text></g>';
    svg = svg.replace('</svg>', box + '</svg>');
  }
  return svg;
}

function buildDonut(q) {
  var segs = (q.segs || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
  if (!segs.length) segs = [40, 25, 15, 20];
  var names = (q.names || '').split(',');
  var total = segs.reduce(function (a, b) { return a + b; }, 0) || 1;
  var R = 168, cx = 540, cy = 690, circ = 2 * Math.PI * R;
  var colors = ['#c4b5fd', '#a78bfa', '#7c3aed', '#3f3a63', '#f472b6'];
  var off = 0, arcs = '';
  for (var i = 0; i < segs.length; i++) {
    var len = segs[i] / total * circ;
    arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + colors[i % colors.length] + '" stroke-width="60" stroke-dasharray="' + len.toFixed(0) + ' ' + (circ - len).toFixed(0) + '" stroke-dashoffset="' + (-off).toFixed(0) + '"/>';
    off += len;
  }
  var center = '<text x="' + cx + '" y="668" text-anchor="middle" fill="#9b93c4" font-size="26" font-weight="700">' + esc(q.c1 || '') + '</text>'
    + '<text x="' + cx + '" y="722" text-anchor="middle" fill="#ffffff" font-size="50" font-weight="700">' + esc(q.c2 || '') + '</text>'
    + '<text x="' + cx + '" y="760" text-anchor="middle" fill="#a78bfa" font-size="30" font-weight="700">' + esc(q.c3 || '') + '</text>';
  var legend = '', lx = [150, 600, 150, 600], ly = [906, 906, 956, 956];
  for (var j = 0; j < Math.min(4, names.length); j++) {
    var pct = Math.round(segs[j] / total * 1000) / 10;
    legend += '<rect x="' + lx[j] + '" y="' + ly[j] + '" width="22" height="22" rx="5" fill="' + colors[j % colors.length] + '"/><text x="' + (lx[j] + 34) + '" y="' + (ly[j] + 18) + '" fill="#e2e8f0" font-size="27" font-weight="700">' + esc(names[j]) + ' <tspan fill="#9b93c4">' + pct + '%</tspan></text>';
  }
  return head(q) + '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">' + arcs + '</g>' + center + legend + foot(q);
}

function buildCandle(q) {
  var raw = (q.ohlc || '').split(';').map(function (c) { return c.split(',').map(Number); }).filter(function (c) { return c.length === 4 && c.every(function (x) { return !isNaN(x); }); });
  if (!raw.length) raw = [[10, 12, 9, 11], [11, 13, 10, 10], [10, 11, 8, 12]];
  var all = []; raw.forEach(function (c) { all.push(c[1], c[2]); });
  var yTop = 560, yBot = 920, mn = Math.min.apply(null, all), mx = Math.max.apply(null, all); if (mx === mn) mx = mn + 1;
  function Y(v) { return yBot - (v - mn) / (mx - mn) * (yBot - yTop); }
  var n = raw.length, x0 = 150, step = (910 - 150) / (n > 1 ? n - 1 : 1), w = Math.min(56, step * 0.55), out = '';
  for (var i = 0; i < n; i++) {
    var c = raw[i], cx = x0 + step * i, up = c[3] >= c[0], col = up ? '#a78bfa' : '#f472b6';
    var bt = Y(Math.max(c[0], c[3])), bb = Y(Math.min(c[0], c[3]));
    out += '<line x1="' + cx.toFixed(0) + '" y1="' + Y(c[1]).toFixed(0) + '" x2="' + cx.toFixed(0) + '" y2="' + Y(c[2]).toFixed(0) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/><rect x="' + (cx - w / 2).toFixed(0) + '" y="' + bt.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + Math.max(4, bb - bt).toFixed(0) + '" rx="4" fill="' + col + '"/>';
  }
  out += '<rect x="150" y="906" width="20" height="20" rx="5" fill="#a78bfa"/><text x="180" y="923" fill="#cbd5e1" font-size="24" font-weight="700">상승</text><rect x="270" y="906" width="20" height="20" rx="5" fill="#f472b6"/><text x="300" y="923" fill="#cbd5e1" font-size="24" font-weight="700">하락</text>';
  return head(q) + out + foot(q);
}

function buildSvg(q) {
  switch (q.type) {
    case 'line': return buildLine(q);
    case 'area': return buildArea(q);
    case 'donut': return buildDonut(q);
    case 'candle': return buildCandle(q);
    case 'bar': default: return buildBar(q);
  }
}

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const fonts = await getFonts();
    if (q.debug) { res.status(200).json({ cwd: process.cwd(), dirname: __dirname, fontCount: fonts.length, diag: _fontDiag, families: fonts.map(fontFamily) }); return; }
    const svg = buildSvg(q);
    const resvg = new Resvg(svg, {
      font: { fontDirs: _fontDir ? [_fontDir] : [], defaultFontFamily: 'Pretendard', loadSystemFonts: false },
      fitTo: { mode: 'width', value: 1080 }
    });
    const png = resvg.render().asPng();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(png);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
