// Builds the whole site into dist/. Run with `npm run build`.

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { esc, html, layout, breadcrumbs, palLink, palPath, avatar, dexLabel, absUrl, adSlot } from './html.mjs';
import { parentsOf, outcomes, recipeCounts } from './lib/breeding.mjs';
import * as content from './content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (f) => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));

const pals = readJson('pals.json');
const breeding = readJson('breeding.json');
const meta = readJson('meta.json');
const data = { pals, breeding };
const counts = recipeCounts(data);

// ---------- assets ----------

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'assets'), { recursive: true });

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const css = readFileSync(join(root, 'src/assets/style.css'), 'utf8');
const lib = readFileSync(join(root, 'src/lib/breeding.mjs'), 'utf8');
const clientData = JSON.stringify({
  meta: { gameVersion: meta.gameVersion, sourceDbVersion: meta.sourceDbVersion },
  pals: pals.map((p) => ({ slug: p.slug, name: p.name, dex: dexLabel(p), power: p.power })),
  breeding,
});
const dataVersion = hash(clientData);
const libVersion = hash(lib);
const app = readFileSync(join(root, 'src/assets/app.js'), 'utf8')
  .replace("'./breeding.js'", `'./breeding.js?v=${libVersion}'`)
  .replace('__DATA_URL__', `/assets/data.json?v=${dataVersion}`);

writeFileSync(join(dist, 'assets/style.css'), css);
writeFileSync(join(dist, 'assets/breeding.js'), lib);
writeFileSync(join(dist, 'assets/app.js'), app);
writeFileSync(join(dist, 'assets/data.json'), clientData);
copyFileSync(join(root, 'src/assets/favicon.svg'), join(dist, 'favicon.svg'));
copyFileSync(join(root, 'src/assets/_headers'), join(dist, '_headers'));

const assets = { css: `/assets/style.css?v=${hash(css)}`, js: `/assets/app.js?v=${hash(app)}` };

// ---------- page writing ----------

const pages = [];
function writePage(page) {
  const file = page.path === '/404' ? join(dist, '404.html') : join(dist, page.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, layout({ ...page, meta }, assets));
  if (!page.noindex && page.path !== '/404') pages.push(page.path);
}

const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: config.name,
  url: absUrl('/'),
};
const webApp = (name, path, description) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  url: absUrl(path),
  description,
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any (web browser)',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
});

const byName = (a, b) => pals[a].name.localeCompare(pals[b].name);
const selfOnly = pals.map((p, i) => i).filter((i) => counts[i] === 0).sort(byName);
const genderedRows = breeding.gendered.map(([a, ga, b, gb, c]) => ({ a, ga, b, gb, c }));
const genderWord = { M: 'male', F: 'female' };
const pairText = (o) => `${pals[o.a].name}${o.ga ? ` (${genderWord[o.ga]})` : ''} + ${pals[o.b].name}${o.gb ? ` (${genderWord[o.gb]})` : ''}`;

const toolShell = (id, inner) => `<section class="card tool" id="${id}">${inner}
<noscript><p class="note">The calculator needs JavaScript. Every result is also listed on the <a href="/pals/">Pal pages</a>, which work without it.</p></noscript></section>`;

// ---------- home: calculator ----------

writePage({
  path: '/',
  pageType: 'calc',
  scripts: true,
  title: `Palworld Breeding Calculator (${pals.length} Pals, 1.0 data)`,
  description: `Free Palworld breeding calculator: pick two parent Pals and see the egg they hatch, including gender-specific combos. Up to date with 1.0 game data, ${pals.length} Pals.`,
  jsonLd: [website, webApp(`${config.name} Palworld Breeding Calculator`, '/', 'Pick two parent Pals and see which Pal hatches from their egg.')],
  body: html`
<section class="hero">
  <h1>Palworld Breeding Calculator</h1>
  <p class="lead">Pick two parents and see the Pal that hatches. Works on your phone, checks all ${breeding.tri.length.toLocaleString('en-US')} parent pairs, and shows when the parents' genders change the result.</p>
</section>
${toolShell('calc', `
  <div class="pick-row">
    <div class="picker" data-role="a" data-label="Parent 1"></div>
    <button type="button" class="icon-btn swap" aria-label="Swap parents" title="Swap parents">⇄</button>
    <div class="picker" data-role="b" data-label="Parent 2"></div>
  </div>
  <div class="result" id="calc-result" aria-live="polite"><p class="muted">Choose two Pals to see their child.</p></div>`)}
${adSlot(config.ads.slots?.belowTool)}
<section class="grid-2">
  <a class="card link-card" href="/find/"><h2>Find parents</h2><p>Choose the Pal you want and see every pair that hatches it.</p></a>
  <a class="card link-card" href="/planner/"><h2>Plan a route</h2><p>Tell us which Pals you own and get the shortest chain of breeding steps to your target.</p></a>
</section>
<section class="prose">
  <h2>How to use the calculator</h2>
  <ol>
    <li>Type or pick the first parent. You can search by name or Paldeck number.</li>
    <li>Pick the second parent. The child appears straight away.</li>
    <li>Tap the child to open its page with every parent pair and its stats.</li>
  </ol>
  <p>Every breeding step needs one male and one female parent, a Breeding Farm and a Cake. Breeding two Pals of the same species always gives that species.</p>

  <h2>Pairs where gender changes the egg</h2>
  <p>In the current data, only one pair of species gives a different child depending on which parent is male:</p>
  <ul>${genderedRows.map((o) => `<li>${esc(pairText(o))} → <a href="${palPath(pals[o.c])}">${esc(pals[o.c].name)}</a></li>`)}</ul>

  <h2>Pals that only hatch from two of their own kind</h2>
  <p>These ${selfOnly.length} Pals never come from two different species, so you need a male and a female of the same Pal (usually caught in the wild):</p>
  <p class="chips">${selfOnly.map((i) => palLink(pals[i]))}</p>

  <h2>Results from older guides may be wrong</h2>
  <p>Breeding results changed when Palworld reached version 1.0. For example, many early guides say Penking + Bushi gives Anubis. With the 1.0 data used here, that pair hatches <a href="/pals/sibelyx/">Sibelyx</a>. Check the game version on any guide before you spend Cakes on it. The version this site uses is shown at the bottom of every page.</p>
  <p>New to breeding? Read <a href="/guide/how-breeding-works/">how Palworld breeding works</a>.</p>
</section>`,
});

// ---------- find parents ----------

writePage({
  path: '/find/',
  pageType: 'find',
  scripts: true,
  title: 'Palworld Parent Finder: Every Combo for Any Pal',
  description: 'Choose any Palworld Pal and see every parent pair that hatches it. Filter by Pals you own. Based on 1.0 game data.',
  jsonLd: [webApp(`${config.name} Parent Finder`, '/find/', 'Find every parent pair that hatches a chosen Pal.')],
  body: html`
<section class="hero">
  <h1>Find parents for any Pal</h1>
  <p class="lead">Choose the Pal you want. You'll see every pair of parents that hatches it, and you can limit the list to Pals you already own.</p>
</section>
${toolShell('find', `
  <div class="picker" data-role="t" data-label="Pal you want"></div>
  <div class="filters">
    <label class="check"><input type="checkbox" id="only-owned"> Only pairs where I own both parents</label>
    <label class="field"><span>Filter by parent name</span><input type="search" id="parent-filter" placeholder="e.g. Lamball" autocomplete="off"></label>
  </div>
  <div class="result" id="find-result" aria-live="polite"><p class="muted">Choose a Pal to list its parents.</p></div>`)}
${adSlot(config.ads.slots?.belowTool)}
<section class="prose">
  <h2>Tips</h2>
  <ul>
    <li>Mark the Pals you own on <a href="/my-pals/">My Pals</a> to use the "only pairs I own" filter.</li>
    <li>If no pair works with what you own, the <a href="/planner/">route planner</a> finds a chain of steps to get there.</li>
    <li>Some Pals only hatch from two of themselves. For those, catching a male and a female is the only route.</li>
  </ul>
</section>`,
});

// ---------- planner ----------

writePage({
  path: '/planner/',
  pageType: 'planner',
  scripts: true,
  title: 'Palworld Breeding Route Planner from Pals You Own',
  description: 'Plan the shortest Palworld breeding route from the Pals you own to the Pal you want. Free, runs in your browser, no account needed.',
  jsonLd: [webApp(`${config.name} Breeding Route Planner`, '/planner/', 'Plan the fewest breeding steps from the Pals you own to a target Pal.')],
  body: html`
<section class="hero">
  <h1>Breeding route planner</h1>
  <p class="lead">Get the fewest breeding steps from the Pals you own to the Pal you want. Your list stays on this device.</p>
</section>
${toolShell('planner', `
  <div class="picker" data-role="t" data-label="Pal you want"></div>
  <p class="owned-summary" id="owned-summary"></p>
  <div class="result" id="plan-result" aria-live="polite"><p class="muted">Choose a target Pal.</p></div>`)}
${adSlot(config.ads.slots?.belowTool)}
<section class="prose">
  <h2>How the planner works</h2>
  <p>It starts from the Pals marked on <a href="/my-pals/">My Pals</a>. At each step it breeds two Pals you have, or have already bred in the plan, and looks for the route with the fewest steps to your target. A Pal bred once can be reused in later steps.</p>
  <p>The plan assumes you can get a male and a female for each step. Steps where the parents' genders change the result say which parent must be male. It doesn't plan passive skills; for that, the free desktop tool <a href="https://github.com/tylercamp/palcalc" rel="noopener">PalCalc</a> can read your save file.</p>
</section>`,
});

// ---------- my pals ----------

writePage({
  path: '/my-pals/',
  pageType: 'mypals',
  scripts: true,
  title: 'My Pals: Track Your Palworld Collection',
  description: 'Tick the Palworld Pals you own. Your list is saved on your device and used by the breeding planner and parent finder. No sign-up.',
  body: html`
<section class="hero">
  <h1>My Pals</h1>
  <p class="lead">Tick the Pals you own. The list is saved in this browser only (no account, nothing sent to us) and powers the <a href="/planner/">planner</a> and the parent finder filter.</p>
</section>
<section class="card tool" id="mypals">
  <div class="toolbar">
    <label class="field grow"><span>Search</span><input type="search" id="my-search" placeholder="Name or #number" autocomplete="off"></label>
    <p class="count" id="my-count" aria-live="polite"></p>
  </div>
  <div class="btn-row">
    <button type="button" class="btn" id="my-export">Export backup</button>
    <label class="btn">Import backup<input type="file" id="my-import" accept="application/json" hidden></label>
    <button type="button" class="btn ghost" id="my-clear">Clear all</button>
  </div>
  <ul class="check-list" id="my-list">${pals.map((p) => `<li data-name="${esc(p.name.toLowerCase())}" data-dex="${esc(dexLabel(p).toLowerCase())}"><label><input type="checkbox" value="${p.slug}" disabled>${avatar(p)}<span>${esc(p.name)}</span><small>${dexLabel(p)}</small></label></li>`)}</ul>
  <noscript><p class="note">My Pals needs JavaScript to save your list.</p></noscript>
</section>`,
});

// ---------- directory ----------

const workTypes = [...new Set(pals.flatMap((p) => Object.keys(p.work)))].sort();
writePage({
  path: '/pals/',
  pageType: 'directory',
  scripts: true,
  title: `All ${pals.length} Palworld Pals: Breeding Combos and Stats`,
  description: `Browse all ${pals.length} Palworld Pals with breeding power, work suitability and every breeding combo. Search by name or Paldeck number.`,
  jsonLd: [breadcrumbs([['/', 'Home'], ['/pals/', 'All Pals']]).ld],
  body: html`
${breadcrumbs([['/', 'Home'], ['/pals/', 'All Pals']]).nav}
<section class="hero">
  <h1>All Palworld Pals</h1>
  <p class="lead">${pals.length} Pals, including variants and the Terraria collaboration Pals. Open any Pal to see how to breed it.</p>
</section>
<section class="card">
  <div class="filters row">
    <label class="field grow"><span>Search</span><input type="search" id="dir-search" placeholder="Name or #number" autocomplete="off"></label>
    <label class="field"><span>Work</span><select id="dir-work"><option value="">Any work</option>${workTypes.map((w) => `<option>${esc(w)}</option>`)}</select></label>
  </div>
  <p class="count" id="dir-count" aria-live="polite">${pals.length} Pals</p>
  <ul class="pal-grid" id="dir-list">${pals.map((p) => `<li data-name="${esc(p.name.toLowerCase())}" data-dex="${esc(dexLabel(p).toLowerCase())}" data-work="${esc(Object.keys(p.work).join('|'))}"><a href="${palPath(p)}">${avatar(p, 'lg')}<span class="nm">${esc(p.name)}</span><small>${dexLabel(p)} · power ${p.power}</small></a></li>`)}</ul>
</section>`,
});

// ---------- individual Pal pages ----------

const dexOrder = pals.map((p, i) => i);
const byPower = [...dexOrder].sort((a, b) => pals[a].power - pals[b].power);

function pairsTable(rows, head) {
  return html`<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`)}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function palPage(i) {
  const p = pals[i];
  const parents = parentsOf(data, i).filter((o) => o.a !== o.b || o.ga);
  parents.sort((x, y) => (Math.min(x.a, x.b) - Math.min(y.a, y.b)) || (Math.max(x.a, x.b) - Math.max(y.a, y.b)));
  const gendered = parents.filter((o) => o.ga);
  const offspring = [];
  for (let b = 0; b < pals.length; b++) for (const o of outcomes(data, i, b)) offspring.push(o);
  const rank = byPower.indexOf(i);
  const near = byPower.slice(Math.max(0, rank - 3), rank + 4).filter((j) => j !== i);
  const prev = pals[i - 1], next = pals[i + 1];

  const name = esc(p.name);
  const dexText = p.collab ? 'a Terraria collaboration Pal' : `Paldeck ${dexLabel(p)}`;
  let summary;
  if (counts[i] === 0) {
    summary = `${name} (${dexText}) can't be hatched from two different Pals. The only breeding route is a male and a female ${name}, so you'll need to catch them first.`;
  } else if (gendered.length) {
    summary = `${name} (${dexText}) comes from a gender-specific combo: ${gendered.map((o) => esc(pairText(o))).join(' or ')}. Swap the genders and you get a different Pal.`;
  } else if (counts[i] <= 4) {
    summary = `${name} (${dexText}) hatches from only ${counts[i] === 1 ? 'one pair' : `${counts[i]} pairs`} of different Pals: ${parents.map((o) => esc(pairText(o))).join(', ')}. Breeding two ${name} also works.`;
  } else {
    summary = `${name} (${dexText}) hatches from ${counts[i].toLocaleString('en-US')} different parent pairs, plus two ${name}. The full list is below.`;
  }

  const LIMIT = 60;
  const parentRows = parents.map((o) => `<tr><td>${palLink(pals[o.a])}${o.ga ? ` <small>(${genderWord[o.ga]})</small>` : ''}</td><td>${palLink(pals[o.b])}${o.gb ? ` <small>(${genderWord[o.gb]})</small>` : ''}</td></tr>`);
  const offspringRows = offspring.map((o) => `<tr><td>${palLink(pals[o.b])}${o.gb ? ` <small>(${genderWord[o.gb]}; ${name} ${genderWord[o.ga]})</small>` : ''}</td><td>${palLink(pals[o.child])}</td></tr>`);

  const work = Object.entries(p.work);
  const crumbs = breadcrumbs([['/', 'Home'], ['/pals/', 'All Pals'], [palPath(p), p.name]]);
  const g = p.gender;

  return {
    path: palPath(p),
    pageType: 'pal',
    title: counts[i] === 0 ? `How to Breed ${p.name} in Palworld (Only From Two ${p.name})` : `How to Breed ${p.name} in Palworld: ${counts[i] <= 4 ? 'Special Combo' : `All ${counts[i].toLocaleString('en-US')} Combos`}`,
    description: counts[i] === 0
      ? `${p.name} can only be bred from two ${p.name} in Palworld. See its breeding power, stats, work suitability and what it hatches with every other Pal.`
      : `Every Palworld breeding combo for ${p.name}${gendered.length ? ' (gender matters)' : ''}: ${counts[i].toLocaleString('en-US')} parent pair${counts[i] === 1 ? '' : 's'}, breeding power ${p.power}, stats and work suitability. 1.0 data.`,
    jsonLd: [crumbs.ld],
    body: html`
${crumbs.nav}
<article class="pal-page">
<header class="pal-head">
  ${avatar(p, 'xl')}
  <div>
    <h1>How to breed ${name}</h1>
    <p class="tags"><span class="tag">${dexLabel(p)}</span><span class="tag">Breeding power ${p.power}</span>${p.variant ? '<span class="tag">Variant</span>' : ''}${p.collab ? '<span class="tag">Collab</span>' : ''}${p.nocturnal ? '<span class="tag">Nocturnal</span>' : ''}</p>
  </div>
</header>
<p class="lead">${summary}</p>
<p class="btn-row">
  <a class="btn" href="/find/?t=${p.slug}">Filter parents by My Pals</a>
  <a class="btn" href="/planner/?t=${p.slug}">Plan a route to ${name}</a>
  <a class="btn ghost" href="/?a=${p.slug}">Breed ${name} with…</a>
</p>
${p.collab ? '<p class="note">Collaboration Pals come from the same game-file data as every other Pal, but their results have not been checked against a second source yet.</p>' : ''}

<section>
  <h2>Parent pairs that hatch ${name}</h2>
  ${parents.length === 0
    ? `<p>No pair of different Pals hatches ${name}. Breed a male and a female ${name}.</p>`
    : parents.length <= LIMIT
      ? pairsTable(parentRows, ['Parent 1', 'Parent 2'])
      : html`${pairsTable(parentRows.slice(0, LIMIT), ['Parent 1', 'Parent 2'])}
<details class="more"><summary>Show all ${parents.length.toLocaleString('en-US')} pairs</summary>${pairsTable(parentRows.slice(LIMIT), ['Parent 1', 'Parent 2'])}</details>`}
  <p class="muted small">Pairs are listed by Paldeck number. Each pair needs one male and one female.${parents.length ? '' : ''}</p>
</section>
${adSlot(config.ads.slots?.inContent)}
<section>
  <h2>What ${name} hatches with each Pal</h2>
  <details class="more"><summary>Show the child for all ${offspring.length} partners</summary>${pairsTable(offspringRows, [`Partner for ${name}`, 'Child'])}</details>
</section>

<section>
  <h2>${name} stats and details</h2>
  <dl class="facts">
    <div><dt>Breeding power</dt><dd>${p.power} <small>(lower is rarer; ${rank + 1} of ${pals.length})</small></dd></div>
    <div><dt>Rarity</dt><dd>${p.rarity}</dd></div>
    <div><dt>Size</dt><dd>${esc(p.size)}</dd></div>
    <div><dt>HP / Attack / Defense</dt><dd>${p.stats.hp} / ${p.stats.attack} / ${p.stats.defense}</dd></div>
    <div><dt>Walk / Run / Ride sprint speed</dt><dd>${p.speed.walk} / ${p.speed.run} / ${p.speed.rideSprint}</dd></div>
    <div><dt>Food</dt><dd>${p.food}</dd></div>
    <div><dt>Wild level</dt><dd>${p.wildLevel ? `${p.wildLevel[0]}–${p.wildLevel[1]}` : 'Not found in the wild data'}</dd></div>
    <div><dt>Gender chance when bred</dt><dd>${g ? `${Math.round(g.male * 100)}% male, ${Math.round(g.female * 100)}% female` : 'Unknown'}</dd></div>
  </dl>
  <h3>Work suitability</h3>
  ${work.length ? `<ul class="work">${work.map(([w, lv]) => `<li><span>${esc(w)}</span><b>Lv ${lv}</b></li>`).join('')}</ul>` : `<p>${name} has no work suitability.</p>`}
</section>

<section>
  <h2>Pals with similar breeding power</h2>
  <p>Pals close in breeding power often appear as each other's parents or children.</p>
  <p class="chips">${near.map((j) => palLink(pals[j]))}</p>
</section>

<nav class="prev-next" aria-label="More Pals">
  ${prev ? `<a href="${palPath(prev)}">← ${esc(prev.name)}</a>` : '<span></span>'}
  ${next ? `<a href="${palPath(next)}">${esc(next.name)} →</a>` : '<span></span>'}
</nav>
</article>`,
  };
}

for (let i = 0; i < pals.length; i++) writePage(palPage(i));

// ---------- guide and info pages ----------

const article = (path, title, description, body, crumbsLabel) => {
  const crumbs = breadcrumbs([['/', 'Home'], [path, crumbsLabel || title]]);
  writePage({ path, title, description, jsonLd: [crumbs.ld], body: html`${crumbs.nav}<article class="prose">${body}</article>` });
};

const ctx = { config, meta, pals, counts, selfOnly, genderedRows, pairText, palLink, esc };
for (const page of content.pages(ctx)) article(page.path, page.title, page.description, page.body, page.crumb);

writePage({
  path: '/404',
  noindex: true,
  title: 'Page not found',
  description: 'This page does not exist. Use the Palworld breeding calculator or browse the list of all Pals instead.',
  body: html`<section class="hero"><h1>Page not found</h1><p class="lead">That page doesn't exist. Try the <a href="/">breeding calculator</a> or the <a href="/pals/">list of all Pals</a>.</p></section>`,
});

// ---------- sitemap, robots, ads.txt ----------

const today = meta.importedOn;
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${absUrl(p)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('/sitemap.xml')}\n`);
if (config.ads.adsenseClient) {
  const pub = config.ads.adsenseClient.replace(/^ca-/, '');
  writeFileSync(join(dist, 'ads.txt'), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
}

console.log(`Built ${pages.length} indexable pages into dist/ for ${config.url}`);
