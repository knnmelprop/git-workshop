// Generates the README diagrams as GitKraken-style SVGs.
// Run: node docs/diagrams/generate.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

const C = {
  bg: '#12151b', panel: '#1b2029', inset: '#151920', border: '#2b3240',
  text: '#e6e9ef', muted: '#8a93a6', faint: '#4a5366', ink: '#0d1117',
  main: '#19b5d6', branch: '#d63fc7', remote: '#f29b38',
  good: '#35d09a', bad: '#ff5f6d', ghost: '#5d667a',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tw = (s, size) => s.length * size * 0.58;
const usedMarkers = new Set();

// ---------- primitives ----------

const icon = {
  laptop: (x, y, col, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="0.5" width="11" height="7.5" rx="1.2"/><path d="M0 10.5h14"/></g>`,
  cloud: (x, y, col, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"><path d="M3.8 10.5h7a3 3 0 0 0 .3-6 4 4 0 0 0-7.6-1A3.5 3.5 0 0 0 3.8 10.5z"/></g>`,
  file: (x, y, col) => `<g transform="translate(${x} ${y})" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"><path d="M1 1h8l5 5v12H1z"/><path d="M9 1v5h5"/></g>`,
  check: (x, y, col) => `<g transform="translate(${x} ${y})"><circle cx="8" cy="8" r="8" fill="${col}"/><path d="M4.5 8.3l2.3 2.3 4.7-4.9" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  cross: (x, y, col) => `<g transform="translate(${x} ${y})"><circle cx="8" cy="8" r="8" fill="${col}"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/></g>`,
};

function text(x, y, s, { size = 13, col = C.text, weight = 400, anchor = 'start', mono = false, italic = false } = {}) {
  return `<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}" font-size="${size}" font-weight="${weight}" fill="${col}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}

function panel(x, y, w, h, { title, sub = [], iconName, step }) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.panel}" stroke="${C.border}"/>`;
  let tx = x + 20;
  if (step) {
    s += `<circle cx="${x + 31}" cy="${y + 27}" r="11" fill="${C.main}"/>` + text(x + 31, y + 31.5, step, { size: 12.5, weight: 700, col: C.ink, anchor: 'middle' });
    tx = x + 50;
  }
  if (iconName) { s += icon[iconName](x + 20, y + 19, C.text, 1.25); tx = x + 46; }
  s += text(tx, y + 32, title, { size: 15.5, weight: 650 });
  sub.forEach((line, i) => { s += text(x + 20, y + 54 + i * 17, line, { size: 12.5, col: C.muted }); });
  return s;
}

function tag(xRight, y, label, col, iconName) {
  const iw = iconName === 'both' ? 34 : iconName ? 18 : 0;
  const w = tw(label, 11.5) + iw + 16;
  const x = xRight - w;
  let s = `<rect x="${x}" y="${y - 10}" width="${w}" height="20" rx="5" fill="${col}"/>`;
  if (iconName === 'both') s += icon.laptop(x + 7, y - 6, C.ink, 0.85) + icon.cloud(x + 23, y - 6, C.ink, 0.85);
  else if (iconName) s += icon[iconName](x + 7, y - 6, C.ink, 0.85);
  s += text(x + 8 + iw, y + 4, label, { size: 11.5, weight: 700, col: C.ink });
  return { svg: s, x };
}

function cmd(cx, cy, label, col, status) {
  const sw = status ? 22 : 0;
  const w = tw(label, 12) + 20 + sw;
  const x = cx - w / 2;
  let s = `<rect x="${x}" y="${cy - 13}" width="${w}" height="26" rx="13" fill="${C.ink}" stroke="${col}" stroke-width="1.5"/>`;
  s += text(x + 10, cy + 4.3, label, { size: 12, mono: true, col, weight: 600 });
  if (status) s += icon[status](x + w - 24, cy - 8, col);
  return s;
}

function marker(col) {
  usedMarkers.add(col);
  return `url(#ah-${col.slice(1)})`;
}

function arrow(d, col, { dashed = false, width = 2.2 } = {}) {
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 5"' : ''} marker-end="${marker(col)}"/>`;
}

// ---------- commit graph ----------
// g: { x: lane-0 x, y: row-0 y, rowH, laneW, lanes: [colors], tagRight, msgX, band: [x, w],
//      commits: [{ id, lane, row, msg, who, kind: 'merge'|'ghost', hl }],
//      edges: [{ from: child, to: parent, bend: 'child'|'parent', ghost }],
//      tags: [{ at, label, color, icon }] }
function graph(g) {
  const rowH = g.rowH ?? 42, laneW = g.laneW ?? 28, R = 10;
  const pos = {};
  for (const c of g.commits) {
    pos[c.id] = { x: g.x + c.lane * laneW, y: g.y + c.row * rowH, col: c.kind === 'ghost' ? C.ghost : (c.color ?? g.lanes[c.lane]), c };
  }
  let bands = '', edges = '', nodes = '', labels = '';

  for (const c of g.commits) {
    if (!c.hl || !g.band) continue;
    const p = pos[c.id];
    bands += `<rect x="${g.band[0]}" y="${p.y - rowH / 2 + 3}" width="${g.band[1]}" height="${rowH - 6}" rx="7" fill="${c.hl}" fill-opacity="0.13"/>`;
    bands += `<rect x="${g.band[0]}" y="${p.y - rowH / 2 + 3}" width="3" height="${rowH - 6}" rx="1.5" fill="${c.hl}"/>`;
  }

  for (const e of g.edges) {
    const a = pos[e.from], b = pos[e.to];
    const col = e.color ?? (a.x === b.x ? a.col : e.bend === 'child' ? b.col : a.col);
    const k = rowH * 0.55;
    let d;
    if (a.x === b.x) d = `M${a.x} ${a.y}V${b.y}`;
    else if (e.bend === 'child') d = `M${a.x} ${a.y}C${a.x} ${a.y + k} ${b.x} ${a.y + rowH - k} ${b.x} ${a.y + rowH}V${b.y}`;
    else d = `M${a.x} ${a.y}V${b.y - rowH}C${a.x} ${b.y - rowH + k} ${b.x} ${b.y - k} ${b.x} ${b.y}`;
    edges += `<path d="${d}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"${e.ghost ? ' stroke-dasharray="4 5" stroke-opacity="0.8"' : ''}/>`;
  }

  for (const c of g.commits) {
    const p = pos[c.id];
    if (c.kind === 'merge') {
      nodes += `<circle cx="${p.x}" cy="${p.y}" r="9" fill="${C.panel}"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="${p.col}"/>`;
    } else if (c.kind === 'ghost') {
      nodes += `<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${C.panel}" stroke="${C.ghost}" stroke-width="2" stroke-dasharray="3 3"/>`;
      nodes += text(p.x, p.y + 4, c.who, { size: 10.5, weight: 700, col: C.ghost, anchor: 'middle' });
    } else {
      nodes += `<circle cx="${p.x}" cy="${p.y}" r="${R + 3}" fill="${C.panel}"/><circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${p.col}"/>`;
      nodes += `<circle cx="${p.x}" cy="${p.y}" r="${R - 2.5}" fill="${C.inset}"/>`;
      nodes += text(p.x, p.y + 4, c.who, { size: 10.5, weight: 700, col: C.text, anchor: 'middle' });
    }
    const ghost = c.kind === 'ghost';
    labels += text(g.msgX, p.y + 4.5, c.msg, { size: 13, col: ghost ? C.ghost : C.text, italic: ghost, weight: c.hl ? 600 : 400 });
  }

  const stack = {};
  for (const t of g.tags ?? []) {
    const p = pos[t.at];
    const right = stack[t.at] ?? g.tagRight;
    const col = t.color ?? p.col;
    const { svg, x } = tag(right, p.y, t.label, col, t.icon);
    if (stack[t.at] === undefined) {
      labels += `<path d="M${right} ${p.y}H${p.x - 13}" stroke="${col}" stroke-width="2" stroke-opacity="0.55" stroke-dasharray="2 3"/>`;
    }
    labels += svg;
    stack[t.at] = x - 6;
  }

  return { svg: bands + edges + nodes + labels, pos };
}

function sectionLabel(x, y, label, iconName) {
  return icon[iconName](x, y - 10, C.muted) + text(x + 21, y, label.toUpperCase(), { size: 11, weight: 700, col: C.muted });
}

function svgDoc(w, h, title, body) {
  const defs = [...usedMarkers].map((col) =>
    `<marker id="ah-${col.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.2L8.5 5 1 8.8z" fill="${col}"/></marker>`).join('');
  usedMarkers.clear();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>${defs}</defs>
<rect width="${w}" height="${h}" rx="16" fill="${C.bg}"/>
${body}
</svg>
`;
}

// ---------- 1. big picture ----------
function bigPicture() {
  const W = 1060, H = 300;
  let s = '';
  // laptop panel
  s += panel(20, 20, 680, 260, { title: 'Your laptop', iconName: 'laptop' });
  s += text(680, 52, 'everything here is private until you push', { size: 12.5, col: C.muted, anchor: 'end' });
  // github panel
  s += panel(810, 20, 230, 260, { title: 'GitHub', iconName: 'cloud' });
  s += text(1020, 52, 'shared', { size: 12.5, col: C.muted, anchor: 'end' });

  const by = 76, bh = 184, bw = 160;
  const boxes = [
    { x: 40, title: 'Working files', cap: 'where you edit', col: C.bad, state: 'untracked' },
    { x: 280, title: 'Staging area', cap: 'what goes in the next commit', col: C.good, state: 'staged' },
    { x: 520, title: 'Local history', cap: 'your save points' },
  ];
  for (const b of boxes) {
    s += `<rect x="${b.x}" y="${by}" width="${bw}" height="${bh}" rx="10" fill="${C.inset}" stroke="${C.border}"/>`;
    s += text(b.x + 14, by + 26, b.title, { size: 13.5, weight: 650 });
    s += text(b.x + 14, by + bh - 14, b.cap, { size: 11.5, col: C.muted });
    if (b.state) {
      s += icon.file(b.x + 18, by + 64, b.col);
      s += text(b.x + 42, by + 78, 'anna.md', { size: 13, mono: true, col: b.col, weight: 600 });
      const cw = tw(b.state, 11) + 16;
      s += `<rect x="${b.x + 42}" y="${by + 90}" width="${cw}" height="19" rx="9.5" fill="${b.col}" fill-opacity="0.16" stroke="${b.col}" stroke-opacity="0.6"/>`;
      s += text(b.x + 42 + cw / 2, by + 103.5, b.state, { size: 11, weight: 600, col: b.col, anchor: 'middle' });
    }
  }
  const hist = [['Add Anna', 'A'], ['Add Ben', 'B'], ['Set up workshop', 'S']];
  const mkGraph = (x, hl) => graph({
    x, y: by + 62, rowH: 36, lanes: [C.main], msgX: x + 20,
    commits: hist.map(([msg, who], i) => ({ id: who, lane: 0, row: i, msg, who, hl: i === 0 ? hl : undefined })),
    edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'S' }],
    band: [x - 20, 150],
  }).svg;
  s += mkGraph(546, C.main);
  s += mkGraph(840);

  const ay = by + 90;
  s += arrow(`M${40 + bw + 6} ${ay}H${280 - 8}`, C.bad) + cmd(240, ay - 22, 'git add', C.bad);
  s += arrow(`M${280 + bw + 6} ${ay}H${520 - 8}`, C.good) + cmd(480, ay - 22, 'git commit', C.good);
  s += arrow(`M686 ${by + 62}H818`, C.main) + cmd(755, by + 40, 'git push', C.main);
  s += arrow(`M818 ${by + 134}H686`, C.remote) + cmd(755, by + 156, 'git pull', C.remote);
  return svgDoc(W, H, 'Where your work lives: working files, staging, local history, GitHub', s);
}

// ---------- 2. push rejected ----------
function pushRejected() {
  const W = 1060, H = 490, PW = 320, PY = 20;
  let s = '';
  const steps = [
    {
      title: 'Push gets rejected', sub: ['Ben pushed first. Your main is', 'missing his commit.'],
      laptop: {
        commits: [{ id: 'a', lane: 0, row: 0, msg: 'Add Anna', who: 'A', hl: C.main }, { id: 's', lane: 0, row: 1, msg: 'Set up workshop', who: 'S' }],
        edges: [{ from: 'a', to: 's' }], tags: [{ at: 'a', label: 'main', icon: 'laptop' }],
      },
      hub: {
        commits: [{ id: 'b', lane: 0, row: 0, msg: 'Add Ben', who: 'B', hl: C.remote }, { id: 's', lane: 0, row: 1, msg: 'Set up workshop', who: 'S' }],
        edges: [{ from: 'b', to: 's' }], tags: [{ at: 'b', label: 'main', icon: 'cloud' }],
      },
      link: { dir: 'down', label: 'git push', col: C.bad, status: 'cross', note: 'rejected' },
    },
    {
      title: 'git pull', sub: ["Downloads Ben's commit and replays", 'yours on top of it.'],
      laptop: {
        commits: [
          { id: 'a2', lane: 0, row: 0, msg: 'Add Anna', who: 'A', hl: C.main },
          { id: 'a', lane: 1, row: 1, msg: 'old Add Anna', who: 'A', kind: 'ghost' },
          { id: 'b', lane: 0, row: 2, msg: 'Add Ben', who: 'B', hl: C.remote },
          { id: 's', lane: 0, row: 3, msg: 'Set up workshop', who: 'S' },
        ],
        edges: [{ from: 'a2', to: 'b' }, { from: 'a', to: 's', bend: 'parent', ghost: true }, { from: 'b', to: 's' }],
        tags: [{ at: 'a2', label: 'main', icon: 'laptop' }, { at: 'b', label: 'origin/main', icon: 'cloud', color: C.remote }],
        moved: ['a', 'a2'],
      },
      hub: {
        commits: [{ id: 'b', lane: 0, row: 0, msg: 'Add Ben', who: 'B' }, { id: 's', lane: 0, row: 1, msg: 'Set up workshop', who: 'S' }],
        edges: [{ from: 'b', to: 's' }], tags: [{ at: 'b', label: 'main', icon: 'cloud' }],
      },
      link: { dir: 'up', label: 'git pull', col: C.remote, note: "gets Ben's commit" },
    },
    {
      title: 'Push again', sub: ["Your history now contains GitHub's,", 'so the push goes through.'],
      laptop: {
        commits: [
          { id: 'a', lane: 0, row: 0, msg: 'Add Anna', who: 'A' },
          { id: 'b', lane: 0, row: 1, msg: 'Add Ben', who: 'B' },
          { id: 's', lane: 0, row: 2, msg: 'Set up workshop', who: 'S' },
        ],
        edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 's' }],
        tags: [{ at: 'a', label: 'main', icon: 'both' }],
      },
      hub: {
        commits: [
          { id: 'a', lane: 0, row: 0, msg: 'Add Anna', who: 'A', hl: C.good },
          { id: 'b', lane: 0, row: 1, msg: 'Add Ben', who: 'B' },
          { id: 's', lane: 0, row: 2, msg: 'Set up workshop', who: 'S' },
        ],
        edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 's' }],
        tags: [{ at: 'a', label: 'main', icon: 'cloud' }],
      },
      link: { dir: 'down', label: 'git push', col: C.good, status: 'check', note: 'accepted' },
    },
  ];

  steps.forEach((st, i) => {
    const px = 20 + i * (PW + 30);
    s += panel(px, PY, PW, 450, { title: st.title, sub: st.sub, step: String(i + 1) });
    const common = { x: px + 150, rowH: 38, lanes: [C.main, C.ghost], tagRight: px + 130, msgX: px + 200, band: [px + 12, PW - 24] };

    s += sectionLabel(px + 20, PY + 104, 'Your laptop', 'laptop');
    const lg = graph({ ...common, y: PY + 130, ...st.laptop });
    s += lg.svg;
    if (st.laptop.moved) {
      const [from, to] = st.laptop.moved.map((id) => lg.pos[id]);
      s += arrow(`M${from.x + 9} ${from.y - 9}Q${from.x + 14} ${to.y + 2} ${to.x + 16} ${to.y}`, C.muted, { dashed: true, width: 1.6 });
    }

    s += sectionLabel(px + 20, PY + 330, 'GitHub', 'cloud');
    s += graph({ ...common, y: PY + 356, ...st.hub }).svg;

    const ax = px + 60, top = PY + 270, bot = PY + 306;
    const l = st.link;
    s += arrow(l.dir === 'down' ? `M${ax} ${top}V${bot}` : `M${ax} ${bot}V${top}`, l.col);
    s += cmd(ax + 72, (top + bot) / 2, l.label, l.col, l.status);
    s += text(ax + 72 + (tw(l.label, 12) + 20 + (l.status ? 22 : 0)) / 2 + 10, (top + bot) / 2 + 4.5, l.note, { size: 12, col: l.col });
  });
  return svgDoc(W, H, 'Push rejected, git pull, push again', s);
}

// ---------- 3. pull request ----------
function pullRequest() {
  const W = 1040, H = 380, PW = 420, PY = 20;
  let s = '';
  const commits = (side) => [
    { id: 'm', lane: 0, row: 0, msg: 'Merge pull request #1', kind: 'merge', hl: side === 'local' ? C.main : C.good },
    { id: 'u', lane: 1, row: 1, msg: 'Update Anna', who: 'A', hl: side === 'local' ? C.branch : C.branch },
    { id: 'a', lane: 0, row: 2, msg: 'Add Anna', who: 'A' },
    { id: 's', lane: 0, row: 3, msg: 'Set up workshop', who: 'S' },
  ];
  const edges = [
    { from: 'm', to: 'a' }, { from: 'm', to: 'u', bend: 'child' },
    { from: 'u', to: 'a', bend: 'parent' }, { from: 'a', to: 's' },
  ];
  const sides = [
    { side: 'local', x: 20, title: 'Your laptop', iconName: 'laptop', ic: 'laptop', steps: { u: '1', m: '4' } },
    { side: 'remote', x: 600, title: 'GitHub', iconName: 'cloud', ic: 'cloud', steps: { u: '2', m: '3' } },
  ];
  let rows;
  for (const sd of sides) {
    s += panel(sd.x, PY, PW, 270, { title: sd.title, iconName: sd.iconName });
    s += text(sd.x + PW - 20, PY + 32, sd.side === 'local' ? 'local branches' : 'remote branches', { size: 12.5, col: C.muted, anchor: 'end' });
    const g = graph({
      x: sd.x + 186, y: PY + 96, rowH: 44, lanes: [C.main, C.branch], tagRight: sd.x + 164, msgX: sd.x + 236,
      band: [sd.x + 12, PW - 24], commits: commits(sd.side), edges,
      tags: [{ at: 'm', label: 'main', icon: sd.ic }, { at: 'u', label: 'anna-update', icon: sd.ic }],
    });
    s += g.svg;
    rows = g.pos;
    for (const [id, n] of Object.entries(sd.steps)) {
      const y = g.pos[id].y;
      s += `<circle cx="${sd.x + 30}" cy="${y}" r="10" fill="${C.ink}" stroke="${C.text}" stroke-opacity="0.7" stroke-width="1.4"/>`;
      s += text(sd.x + 30, y + 4, n, { size: 11.5, weight: 700, anchor: 'middle' });
    }
  }
  const yu = rows.u.y, ym = rows.m.y;
  s += arrow(`M448 ${yu}H592`, C.branch) + cmd(520, yu - 20, 'git push -u', C.branch);
  s += arrow(`M592 ${ym}H448`, C.main) + cmd(520, ym - 20, 'git pull', C.main);

  const legend = [
    ['1', 'git switch -c anna-update, edit, commit'],
    ['2', 'git push -u origin anna-update'],
    ['3', 'Open PR, neighbor approves, Merge'],
    ['4', 'git switch main + git pull'],
  ];
  legend.forEach(([n, label], i) => {
    const lx = 32 + (i % 2) * 520, ly = PY + 300 + Math.floor(i / 2) * 28;
    s += `<circle cx="${lx}" cy="${ly - 4}" r="10" fill="${C.ink}" stroke="${C.text}" stroke-opacity="0.7" stroke-width="1.4"/>`;
    s += text(lx, ly, n, { size: 11.5, weight: 700, anchor: 'middle' });
    s += text(lx + 20, ly + 0.5, label, { size: 13, col: C.muted });
  });
  return svgDoc(W, H, 'Pull request: branch, push, merge on GitHub, pull', s);
}

for (const [name, fn] of [['big-picture', bigPicture], ['push-rejected', pushRejected], ['pull-request', pullRequest]]) {
  writeFileSync(join(OUT, `${name}.svg`), fn());
  console.log(`wrote ${name}.svg`);
}
