// Draws every card in cards/ from profile.json, data/contributions.json and data/portrait-{light,dark}.txt.
// Look: ashternext.com's tokens (warm paper, ink, wine, Bricolage Grotesque condensed and
// Geist Mono). Fonts are subset per card and embedded, so the SVGs render the same in any
// <img>. Spacing between cards is baked in: full-width cards carry a 16px gap below, and
// three-up cards inset themselves so the row has 12px gutters.
import subsetFont from "subset-font";
import { mkdir } from "node:fs/promises";

const root = new URL("..", import.meta.url).pathname;
const read = (p: string) => Bun.file(root + p);

const profile = await read("profile.json").json();
const contrib: { total: number; days: { date: string; count: number }[] } = await read("data/contributions.json").json();
const portraits = {
  light: (await read("data/portrait-light.txt").text()).replace(/\n+$/, "").split("\n"),
  dark: (await read("data/portrait-dark.txt").text()).replace(/\n+$/, "").split("\n"),
};

// ashternext.com's light and dark tokens. `wine` is the site's primary in each theme.
type Theme = typeof LIGHT;
const LIGHT = {
  paper: "#f5f3ee",
  ink: "#1a1916",
  muted: "#5f5b53",
  line: "#e4e0d6",
  lineStrong: "#d6d1c4",
  wine: "#6d213c",
  band: "#7d2346", // the burgundy sweep through the name
  heat: ["#e4e0d6", "#e3c3cd", "#c47f96", "#99415f", "#6d213c"],
};
const DARK: Theme = {
  paper: "#1d1a18",
  ink: "#f3efe8",
  muted: "#a39b8f",
  line: "#2d2a26",
  lineStrong: "#3b3732",
  wine: "#de7091",
  band: "#b8406a",
  heat: ["#2d2a26", "#4a2532", "#7a3a50", "#ab5170", "#de7091"],
};
const THEMES = [["", LIGHT], ["-dark", DARK]] as const;
let T: Theme = LIGHT;

const W = 880;
const GAP = 16;
const R = 14;
const PAD = 36;

// ── fonts ───────────────────────────────────────────────────────────────────
const bricolageSrc = Buffer.from(
  await read("node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wdth-normal.woff2").arrayBuffer(),
);
const monoSrc = Buffer.from(await read("node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2").arrayBuffer());
const mono500Src = Buffer.from(await read("node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2").arrayBuffer());

async function fontCss(display: string, mono: string, monoBold = ""): Promise<string> {
  const parts: string[] = [];
  const face = async (family: string, src: Buffer, text: string, weight: string, axes?: object) => {
    if (!text) return;
    const buf = await subsetFont(src, text + " ", { targetFormat: "woff2", ...(axes ? { variationAxes: axes } : {}) });
    parts.push(
      `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2')}`,
    );
  };
  // Pin the width axis at the site's condensed display width; keep a weight range.
  await face("Bricolage", bricolageSrc, display, "400 750", { wdth: 82, wght: { min: 400, max: 750 } });
  await face("GeistMono", monoSrc, mono, "400");
  await face("GeistMono", mono500Src, monoBold, "500");
  return parts.join("");
}

// ── helpers ─────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number) => n.toLocaleString("en-US");

type Text = { display: string; mono: string; monoBold: string };
const collect = (): Text => ({ display: "", mono: "", monoBold: "" });

function svg(width: number, height: number, label: string, css: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">` +
    `<title>${esc(label)}</title><style>${css}` +
    `.d{font-family:'Bricolage',ui-sans-serif,system-ui,sans-serif}.m{font-family:'GeistMono',ui-monospace,monospace}` +
    `@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>${body}</svg>`
  );
}

function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out;
}

const card = (x: number, w: number, h: number, fill?: string, stroke?: string) =>
  `<rect x="${x + 0.5}" y="0.5" width="${w - 1}" height="${h - 1}" rx="${R}" fill="${fill ?? T.paper}" stroke="${stroke ?? T.line}"/>`;

const files: Record<string, string> = {};

for (const [sfx, theme] of THEMES) {
  T = theme;


  // ── hero ────────────────────────────────────────────────────────────────────
  {
    const h = profile.hero;
    const H = 420;
    const t = collect();
    const parts: string[] = [card(0, W, H)];

    t.mono += h.label + h.link;
    parts.push(
      `<rect x="${PAD}" y="${PAD + 2}" width="8" height="8" fill="${T.wine}"/>`,
      `<text class="m" x="${PAD + 16}" y="${PAD + 10}" font-size="11" letter-spacing="1.3" fill="${T.muted}">${esc(h.label)}</text>`,
    );

    t.display += h.first + h.last + h.tagline;
    parts.push(
      // "Maalik" is filled with an ink gradient that has a burgundy band in the middle; the
      // band is slightly slanted and slides across the word every 7s, once the name has risen in.
      `<defs><linearGradient id="sweep" gradientUnits="userSpaceOnUse" x1="0" y1="100" x2="480" y2="40">` +
        `<stop offset="0" stop-color="${T.ink}"/><stop offset=".4" stop-color="${T.ink}"/>` +
        `<stop offset=".5" stop-color="${T.band}"/><stop offset=".6" stop-color="${T.ink}"/><stop offset="1" stop-color="${T.ink}"/>` +
        `<animateTransform attributeName="gradientTransform" type="translate" values="-420 0;420 0;420 0" keyTimes="0;.45;1" dur="7s" begin="1.2s" repeatCount="indefinite"/>` +
        `</linearGradient></defs>`,
      `<g class="rise"><text class="d" x="${PAD - 4}" y="150" font-size="108" font-weight="700" letter-spacing="-4" fill="url(#sweep)">${esc(h.first)}</text>`,
      `<text class="d" x="${PAD - 4}" y="240" font-size="108" font-weight="700" letter-spacing="-4" fill="${T.ink}">${esc(h.last)}</text></g>`,
    );
    // The link sits on the card's bottom padding line; the tagline stacks up from just above it.
    const tag = wrap(h.tagline, 46);
    const linkY = H - PAD - 4;
    const tagTop = linkY - 46 - (tag.length - 1) * 24;
    tag.forEach((line, i) =>
      parts.push(`<text class="d fade" x="${PAD}" y="${tagTop + i * 24}" font-size="19" font-weight="400" fill="${T.muted}">${esc(line)}</text>`),
    );
    parts.push(
      `<text class="m fade" x="${PAD}" y="${linkY}" font-size="12" fill="${T.wine}">${esc(h.link)} <tspan dx="2">↗</tspan></text>`,
      `<line class="fade" x1="${PAD}" x2="${PAD + h.link.length * 7.2}" y1="${linkY + 6}" y2="${linkY + 6}" stroke="${T.wine}" stroke-width="1"/>`,
    );
    t.mono += "↗";

    // Portrait: small characters (like a halftone) so the face reads clearly; each row
    // fades in top to bottom.
    const portrait = sfx ? portraits.dark : portraits.light;
    const fs = 4;
    const cw = fs * 0.6;
    const cols = Math.max(...portrait.map((l) => l.length));
    const px = W - cols * cw - 28;
    const py = H - portrait.length * fs + fs * 2;
    t.mono += [...new Set(portrait.join(""))].join("");
    // Each run of characters is placed at its column, so no browser can collapse or
    // re-measure the spaces between them.
    const rows = portrait
      .map((line, i) => {
        const runs = [...line.matchAll(/\S+/g)]
          .map((m) => `<tspan x="${(px + m.index! * cw).toFixed(2)}">${esc(m[0])}</tspan>`)
          .join("");
        return runs ? `<text y="${(py + i * fs).toFixed(2)}" style="animation-delay:${(0.2 + i * 0.012).toFixed(3)}s">${runs}</text>` : "";
      })
      .join("");
    parts.push(
      `<clipPath id="c"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}"/></clipPath>`,
      `<g class="m art" clip-path="url(#c)" font-size="${fs}" fill="${T.ink}">${rows}</g>`,
    );

    const css =
      (await fontCss(t.display, t.mono)) +
      `.art text{opacity:0;animation:in .5s ease-out forwards}` +
      `.rise{animation:rise .8s cubic-bezier(.2,.7,.2,1) both}.fade{opacity:0;animation:in .8s .5s ease-out forwards}` +
      `@keyframes in{to{opacity:1}}@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`;
    files[`hero${sfx}.svg`] = svg(W, H + GAP, h.alt, css, parts.join(""));
  }

  // ── contribution data ───────────────────────────────────────────────────────
  const days = contrib.days;
  const counts = days.map((d) => d.count);
  const nonzero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (c: number) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ── heatmap ─────────────────────────────────────────────────────────────────
  {
    const H = 232;
    const t = collect();
    const shades = T.heat;
    const parts: string[] = [card(0, W, H)];

    t.display += "Every day, in wine";
    t.mono += "REFRESHED DAILY less more " + MONTHS.join("");
    parts.push(
      `<text class="d" x="${PAD}" y="${PAD + 26}" font-size="34" font-weight="600" letter-spacing="-1" fill="${T.ink}">Every day, <tspan fill="${T.wine}">in wine</tspan></text>`,
      `<text class="m" x="${W - PAD}" y="${PAD + 20}" font-size="10.5" letter-spacing="1.3" fill="${T.muted}" text-anchor="end">REFRESHED DAILY</text>`,
    );

    // Columns are weeks starting Sunday, as on GitHub.
    const first = new Date(days[0].date + "T00:00:00Z");
    const offset = first.getUTCDay();
    const weeks = Math.ceil((days.length + offset) / 7);
    const gx = PAD, gy = 94;
    const step = (W - 2 * PAD + 3) / weeks;
    const size = step - 3;
    const cells: string[] = [];
    const monthLabels: string[] = [];
    let lastMonth = -1;
    days.forEach((d, i) => {
      const k = i + offset;
      const col = Math.floor(k / 7), row = k % 7;
      const x = gx + col * step, y = gy + row * step;
      cells.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" rx="2.5" fill="${shades[level(d.count)]}" style="animation-delay:${(col * 0.018).toFixed(3)}s"/>`,
      );
      const m = new Date(d.date + "T00:00:00Z").getUTCMonth();
      if (row === 0 && m !== lastMonth && x < W - PAD - 150) {
        if (lastMonth !== -1 || new Date(d.date + "T00:00:00Z").getUTCDate() <= 7)
          monthLabels.push(`<text class="m" x="${x.toFixed(2)}" y="${gy + 7 * step + 14}" font-size="10" fill="${T.muted}">${MONTHS[m]}</text>`);
        lastMonth = m;
      }
    });
    parts.push(`<g class="cells">${cells.join("")}</g>`, monthLabels.join(""));

    const ly = gy + 7 * step + 4;
    const lx = W - PAD - 5 * 13 - 30;
    parts.push(`<text class="m" x="${lx - 8}" y="${ly + 10}" font-size="10" fill="${T.muted}" text-anchor="end">less</text>`);
    shades.forEach((s, i) => parts.push(`<rect x="${lx + i * 13}" y="${ly + 1}" width="10" height="10" rx="2" fill="${s}"/>`));
    parts.push(`<text class="m" x="${lx + 5 * 13 + 4}" y="${ly + 10}" font-size="10" fill="${T.muted}">more</text>`);

    const css =
      (await fontCss(t.display, t.mono)) +
      `.cells rect{opacity:0;transform-box:fill-box;transform-origin:center;animation:pop .45s cubic-bezier(.2,.8,.3,1.3) forwards}` +
      `@keyframes pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}`;
    files[`heatmap${sfx}.svg`] = svg(W, H + GAP, `${fmt(contrib.total)} contributions in the last year, refreshed daily`, css, parts.join(""));
  }

  // ── activity ────────────────────────────────────────────────────────────────
  {
    const H = 330;
    const t = collect();
    const parts: string[] = [card(0, W, H)];

    // Last 12 calendar months, ending with the current (partial) one.
    const lastDate = new Date(days[days.length - 1].date + "T00:00:00Z");
    const months: { key: string; label: string; total: number; partial: boolean }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      months.push({ key, label: MONTHS[d.getUTCMonth()], total: 0, partial: i === 0 });
    }
    for (const d of days) {
      const m = months.find((m) => m.key === d.date.slice(0, 7));
      if (m) m.total += d.count;
    }

    let longest = 0, run = 0;
    for (const c of counts) {
      run = c > 0 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    let current = 0;
    for (let i = counts.length - 1 - (counts[counts.length - 1] === 0 ? 1 : 0); i >= 0 && counts[i] > 0; i--) current++;
    const active = counts.filter((c) => c > 0).length;
    const busiest = days.reduce((a, b) => (b.count > a.count ? b : a));

    const label = "THE LAST 12 MONTHS ON GITHUB";
    const big = `${fmt(contrib.total)}`;
    t.mono += label + months.map((m) => m.label).join("") + "0123456789,";
    t.display += big + " contributions days current streak, and the longest " + fmt(longest) + fmt(current) + `${active}/${days.length}` + " with a commit on the busiest day" + fmt(busiest.count);

    parts.push(
      `<text class="m" x="${PAD}" y="${PAD + 10}" font-size="10.5" letter-spacing="1.3" fill="${T.muted}">${label}</text>`,
      `<text class="d" x="${PAD - 2}" y="${PAD + 62}" font-size="52" font-weight="650" letter-spacing="-2" fill="${T.ink}">${big} <tspan font-weight="450" fill="${T.wine}">contributions</tspan></text>`,
    );

    // Bars
    const bx = PAD, bw = 540, by = 286, bh = 150;
    const slot = bw / 12;
    const max = Math.max(...months.map((m) => m.total), 1);
    const top = months.reduce((a, b) => (b.total > a.total ? b : a));
    months.forEach((m, i) => {
      const hgt = Math.max(3, (m.total / max) * bh);
      const x = bx + i * slot + 3;
      const fill = m === top ? T.wine : m.partial ? T.lineStrong : T.ink;
      parts.push(
        `<rect class="bar" x="${x.toFixed(2)}" y="${(by - hgt).toFixed(2)}" width="${(slot - 9).toFixed(2)}" height="${hgt.toFixed(2)}" rx="2" fill="${fill}" style="animation-delay:${(0.1 + i * 0.05).toFixed(2)}s"/>`,
        `<text class="m" x="${(x + (slot - 9) / 2).toFixed(2)}" y="${by + 18}" font-size="10" fill="${T.muted}" text-anchor="middle">${m.label}</text>`,
      );
      if (m === top)
        parts.push(
          `<text class="m" x="${(x + (slot - 9) / 2).toFixed(2)}" y="${(by - hgt - 7).toFixed(2)}" font-size="10" fill="${T.wine}" text-anchor="middle">${fmt(m.total)}</text>`,
        );
    });

    // Stats column
    const sx = 630;
    const stat = (y: number, value: string, rest: string, caption: string, divider: boolean) =>
      `<text class="d" x="${sx}" y="${y}" font-size="34" font-weight="600" letter-spacing="-1" fill="${T.ink}">${value}${rest ? ` <tspan font-weight="400" fill="${T.muted}">${rest}</tspan>` : ""}</text>` +
      `<text class="d" x="${sx}" y="${y + 20}" font-size="14" fill="${T.muted}">${caption}</text>` +
      (divider ? `<line x1="${sx}" x2="${W - PAD}" y1="${y + 36}" y2="${y + 36}" stroke="${T.line}"/>` : "");
    parts.push(
      `<g class="fade">`,
      stat(132, `${fmt(current)} days`, "", `current streak, longest ${fmt(longest)}`, true),
      stat(208, `${fmt(active)}`, `/ ${days.length}`, "days with a commit", true),
      stat(284, fmt(busiest.count), "", "on the busiest day", false),
      `</g>`,
    );

    const css =
      (await fontCss(t.display, t.mono)) +
      `.bar{transform-box:fill-box;transform-origin:bottom;animation:grow .7s cubic-bezier(.2,.7,.2,1) both}.fade{opacity:0;animation:in .8s .4s forwards}` +
      `@keyframes grow{from{transform:scaleY(0)}to{transform:none}}@keyframes in{to{opacity:1}}`;
    files[`activity${sfx}.svg`] = svg(
      W,
      H + GAP,
      `${fmt(contrib.total)} contributions in the last 12 months. Current streak ${current} days, ${active} of ${days.length} days with a commit, ${busiest.count} on the busiest day.`,
      css,
      parts.join(""),
    );
  }

  // ── three-up helpers ────────────────────────────────────────────────────────
  const TW = W / 3;
  const inset = (i: number) => i * 4;
  const TCW = TW - 8; // 3 cards + 2 gaps of 12 = 880; card i sits at i*4 inside its slot

  // ── tiles ───────────────────────────────────────────────────────────────────
  // Tiles carry their own colour, so one version serves both themes.
  for (const [i, tile] of (sfx ? [] : (profile.tiles as any[])).entries()) {
    const H = 232;
    const t = collect();
    const x0 = inset(i);
    const fg = tile.dark ? "#1a1916" : "#ffffff";
    const sub = tile.dark ? "rgba(26,25,22,.78)" : "rgba(255,255,255,.86)";
    const parts: string[] = [card(x0, TCW, H, tile.color, tile.color)];
    t.mono += tile.label + "→";
    t.display += tile.value + tile.unit + tile.body;
    parts.push(
      `<text class="m" x="${x0 + 24}" y="${36}" font-size="10.5" letter-spacing="1.3" fill="${fg}">${esc(tile.label)}</text>`,
      `<text class="m" x="${x0 + TCW - 24}" y="${36}" font-size="13" fill="${fg}" text-anchor="end">→</text>`,
      `<text class="d rise" x="${x0 + 22}" y="${124}" font-size="46" font-weight="650" letter-spacing="-1.6" fill="${fg}">${esc(tile.value)} <tspan font-weight="400">${esc(tile.unit)}</tspan></text>`,
    );
    wrap(tile.body, 34).forEach((line, j) =>
      parts.push(`<text class="d" x="${x0 + 24}" y="${160 + j * 20}" font-size="15" fill="${sub}">${esc(line)}</text>`),
    );
    const css =
      (await fontCss(t.display, t.mono)) +
      `.rise{animation:rise .8s ${0.15 + i * 0.12}s cubic-bezier(.2,.7,.2,1) both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`;
    files[`tile-${tile.id}.svg`] = svg(TW, H + GAP, `${tile.label}: ${tile.value} ${tile.unit}. ${tile.body}`, css, parts.join(""));
  }

  // ── section title (sits on GitHub's page, not a card) ──────────────────────
  {
    const t = collect();
    t.display += profile.building.title + profile.building.accent;
    files[`title-building${sfx}.svg`] = svg(
      W,
      64,
      `${profile.building.title} ${profile.building.accent}`,
      await fontCss(t.display, ""),
      `<text class="d" x="2" y="42" font-size="34" font-weight="600" letter-spacing="-1" fill="${T.ink}">${esc(profile.building.title)} <tspan fill="${T.wine}">${esc(profile.building.accent)}</tspan></text>`,
    );
  }

  // ── product cards ───────────────────────────────────────────────────────────
  for (const [i, p] of (profile.building.items as any[]).entries()) {
    const H = 196;
    const t = collect();
    const x0 = inset(i);
    const parts: string[] = [card(x0, TCW, H)];
    t.monoBold += p.name;
    t.mono += p.stack + "↗";
    t.display += p.body;
    parts.push(
      `<rect x="${x0 + 24}" y="${28}" width="9" height="9" fill="${p.color}"/>`,
      `<text class="m" x="${x0 + 42}" y="${37}" font-size="14" font-weight="500" fill="${T.ink}">${esc(p.name)}</text>`,
      `<text class="m" x="${x0 + TCW - 24}" y="${37}" font-size="12" fill="${T.muted}" text-anchor="end">↗</text>`,
    );
    wrap(p.body, 36).forEach((line, j) =>
      parts.push(`<text class="d" x="${x0 + 24}" y="${76 + j * 21}" font-size="16" fill="${T.ink}">${esc(line)}</text>`),
    );
    parts.push(`<text class="m" x="${x0 + 24}" y="${H - 26}" font-size="11" fill="${T.muted}">${esc(p.stack)}</text>`);
    files[`product-${p.id}${sfx}.svg`] = svg(TW, H + GAP, `${p.name}: ${p.body}`, await fontCss(t.display, t.mono, t.monoBold), parts.join(""));
  }
}

// ── write ───────────────────────────────────────────────────────────────────
await mkdir(root + "cards", { recursive: true });
for (const [name, body] of Object.entries(files)) {
  await Bun.write(root + "cards/" + name, body);
  console.log(`cards/${name}  ${(body.length / 1024).toFixed(1)} KB`);
}
