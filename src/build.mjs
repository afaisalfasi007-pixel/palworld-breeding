// Builds the whole site into dist/. Run with `npm run build`.

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { esc, html, layout, breadcrumbs, palLink, palPath, avatar, dexLabel, absUrl, adSlot, icon } from './html.mjs';
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
<noscript><p class="note">${icon('info')}<span>This tool needs JavaScript. Every result is also listed on the <a href="/pals/">Pal pages</a>, which work without it.</span></p></noscript></section>`;

const sexTag = (g) => (g ? `<span class="sex sex-${g}">${genderWord[g]}</span>` : '');
const pairItem = (left, op, right) => `<li class="pair"><span class="side">${left}</span><span class="op">${icon(op)}</span><span class="side">${right}</span></li>`;
const pairList = (items, cls = '') => `<ul class="pairs ${cls}">${items.join('')}</ul>`;

const hero = (eyebrow, title, lead) => html`
<section class="hero">
  ${eyebrow ? `<p class="eyebrow">${icon('sparkle')}<span>${eyebrow}</span></p>` : ''}
  <h1>${title}</h1>
  <p class="lead">${lead}</p>
</section>`;

const emptyState = (ic, text) => `<div class="empty">${icon(ic, 'i-lg')}<p>${text}</p></div>`;

// ---------- home: calculator ----------

writePage({
  path: '/',
  pageType: 'calc',
  scripts: true,
  title: `Palworld Breeding Calculator (${pals.length} Pals, 1.0 data)`,
  description: `Free Palworld breeding calculator: pick two parent Pals and see the egg they hatch, including gender-specific combos. Up to date with 1.0 game data, ${pals.length} Pals.`,
  jsonLd: [website, webApp(`${config.name} Palworld Breeding Calculator`, '/', 'Pick two parent Pals and see which Pal hatches from their egg.')],
  body: html`
${hero(`Palworld 1.0 data · ${pals.length} Pals`, 'Palworld Breeding Calculator', `Pick two parents and see the Pal that hatches. Every one of the ${breeding.tri.length.toLocaleString('en-US')} parent pairs is covered, including the pairs where gender changes the egg.`)}
${toolShell('calc', `
  <div class="equation">
    <div class="picker" data-role="a" data-label="Parent 1"></div>
    <div class="op-row">
      <span class="op-badge">${icon('plus')}</span>
      <button type="button" class="icon-btn swap" aria-label="Swap parents" title="Swap parents">${icon('swap')}</button>
    </div>
    <div class="picker" data-role="b" data-label="Parent 2"></div>
  </div>
  <div class="result" id="calc-result" aria-live="polite">${emptyState('egg', 'Choose two Pals to see their egg.')}</div>`)}
${adSlot(config.ads.slots?.belowTool)}
<ul class="trust" aria-label="Why use this calculator">
  <li>${icon('bolt')}<span><b>Instant</b> Runs in your browser</span></li>
  <li>${icon('check')}<span><b>Checked data</b> Game-file export, row by row</span></li>
  <li>${icon('heart')}<span><b>Free</b> No sign-up</span></li>
</ul>
<section class="feature-grid">
  <a class="card feature" href="/find/"><span class="feature-ic">${icon('search')}</span><span><b>Find parents</b><span>Every pair that hatches the Pal you want.</span></span>${icon('chevron', 'go')}</a>
  <a class="card feature" href="/planner/"><span class="feature-ic">${icon('route')}</span><span><b>Plan a route</b><span>The fewest steps from the Pals you own.</span></span>${icon('chevron', 'go')}</a>
  <a class="card feature" href="/my-pals/"><span class="feature-ic">${icon('check')}</span><span><b>My Pals</b><span>Tick what you own. Saved on your device.</span></span>${icon('chevron', 'go')}</a>
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
</section>
${pairList(genderedRows.map((o) => pairItem(`${palLink(pals[o.a])}${sexTag(o.ga)}<span class="plus">+</span>${palLink(pals[o.b])}${sexTag(o.gb)}`, 'arrow', palLink(pals[o.c]))), 'wide')}
<section class="prose">
  <h2>Pals that only hatch from two of their own kind</h2>
  <p>These ${selfOnly.length} Pals never come from two different species, so you need a male and a female of the same Pal (usually caught in the wild):</p>
</section>
<p class="chips">${selfOnly.map((i) => palLink(pals[i]))}</p>
<section class="prose">
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
${hero('', 'Find parents for any Pal', "Choose the Pal you want. You'll see every pair of parents that hatches it, and you can limit the list to Pals you already own.")}
${toolShell('find', `
  <div class="picker" data-role="t" data-label="Pal you want"></div>
  <div class="filters">
    <label class="switch"><input type="checkbox" id="only-owned" role="switch"><span class="track" aria-hidden="true"></span><span>Only pairs where I own both parents</span></label>
    <label class="field search-field"><span>Filter by parent name</span>${icon('search')}<input type="search" id="parent-filter" placeholder="e.g. Lamball" autocomplete="off"></label>
  </div>
  <div class="result" id="find-result" aria-live="polite">${emptyState('search', 'Choose a Pal to list its parents.')}</div>`)}
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
${hero('', 'Breeding route planner', 'Get the fewest breeding steps from the Pals you own to the Pal you want. Your list stays on this device.')}
${toolShell('planner', `
  <div class="picker" data-role="t" data-label="Pal you want"></div>
  <p class="status-pill" id="owned-summary"></p>
  <div class="result" id="plan-result" aria-live="polite">${emptyState('route', 'Choose a target Pal.')}</div>`)}
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
${hero('', 'My Pals', 'Tick the Pals you own. The list is saved in this browser only (no account, nothing sent to us) and powers the <a href="/planner/">planner</a> and the parent finder filter.')}
<section class="card tool" id="mypals">
  <div class="sticky-tools">
    <label class="field search-field"><span>Search</span>${icon('search')}<input type="search" id="my-search" placeholder="Name or #number" autocomplete="off"></label>
    <div class="progress-row">
      <p class="count" id="my-count" aria-live="polite">0 of ${pals.length} owned</p>
      <div class="progress" aria-hidden="true"><span id="my-bar"></span></div>
    </div>
  </div>
  <div class="btn-row">
    <button type="button" class="btn ghost small" id="my-export">${icon('download')}<span>Export backup</span></button>
    <label class="btn ghost small">${icon('upload')}<span>Import backup</span><input type="file" id="my-import" accept="application/json" hidden></label>
    <button type="button" class="btn ghost small danger" id="my-clear">${icon('trash')}<span>Clear all</span></button>
  </div>
  <ul class="check-list" id="my-list">${pals.map((p) => `<li data-name="${esc(p.name.toLowerCase())}" data-dex="${esc(dexLabel(p).toLowerCase())}"><label><input type="checkbox" value="${p.slug}" disabled>${avatar(p)}<span class="nm">${esc(p.name)}</span><small>${dexLabel(p)}</small></label></li>`)}</ul>
  <noscript><p class="note">${icon('info')}<span>My Pals needs JavaScript to save your list.</span></p></noscript>
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
${hero('', 'All Palworld Pals', `${pals.length} Pals, including variants and the Terraria collaboration Pals. Open any Pal to see how to breed it.`)}
<section class="dir-tools">
  <label class="field search-field"><span>Search</span>${icon('search')}<input type="search" id="dir-search" placeholder="Name or #number" autocomplete="off"></label>
  <div class="chip-row" role="group" aria-label="Filter by work">
    <button type="button" class="chip-btn" data-work="" aria-pressed="true">All</button>
    ${workTypes.map((w) => `<button type="button" class="chip-btn" data-work="${esc(w)}" aria-pressed="false">${esc(w)}</button>`)}
  </div>
  <p class="count" id="dir-count" aria-live="polite">${pals.length} Pals</p>
</section>
<ul class="pal-grid" id="dir-list">${pals.map((p) => `<li data-name="${esc(p.name.toLowerCase())}" data-dex="${esc(dexLabel(p).toLowerCase())}" data-work="${esc(Object.keys(p.work).join('|'))}"><a href="${palPath(p)}"><span class="dex">${dexLabel(p)}</span>${avatar(p, 'lg')}<span class="nm">${esc(p.name)}</span><span class="pow">Power ${p.power}</span></a></li>`)}</ul>`,
});

// ---------- individual Pal pages ----------

const dexOrder = pals.map((p, i) => i);
const byPower = [...dexOrder].sort((a, b) => pals[a].power - pals[b].power);
const statMax = {
  hp: Math.max(...pals.map((p) => p.stats.hp)),
  attack: Math.max(...pals.map((p) => p.stats.attack)),
  defense: Math.max(...pals.map((p) => p.stats.defense)),
};
const workMax = Math.max(...pals.flatMap((p) => Object.values(p.work)));

function statBar(label, value, max) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return `<div class="stat"><span class="stat-label">${label}</span><span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span><b>${value}</b></div>`;
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

  const LIMIT = 40;
  const parentItems = parents.map((o) => pairItem(`${palLink(pals[o.a])}${sexTag(o.ga)}`, 'plus', `${palLink(pals[o.b])}${sexTag(o.gb)}`));
  const offspringItems = offspring.map((o) => pairItem(`${palLink(pals[o.b])}${o.gb ? `${sexTag(o.gb)}<small class="with">with ${genderWord[o.ga]} ${name}</small>` : ''}`, 'arrow', palLink(pals[o.child])));

  const work = Object.entries(p.work);
  const crumbs = breadcrumbs([['/', 'Home'], ['/pals/', 'All Pals'], [palPath(p), p.name]]);
  const g = p.gender;
  const recipeLabel = counts[i] === 0 ? 'Self only' : counts[i].toLocaleString('en-US');

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
<header class="card pal-hero">
  <div class="pal-head">
    ${avatar(p, 'xl')}
    <div>
      <p class="tags"><span class="tag">${dexLabel(p)}</span>${p.variant ? '<span class="tag">Variant</span>' : ''}${p.collab ? '<span class="tag">Collab</span>' : ''}${p.nocturnal ? '<span class="tag">Nocturnal</span>' : ''}</p>
      <h1>How to breed ${name}</h1>
    </div>
  </div>
  <dl class="kpis">
    <div><dt>Breeding power</dt><dd>${p.power}</dd></div>
    <div><dt>Parent pairs</dt><dd>${recipeLabel}</dd></div>
    <div><dt>Rarity</dt><dd>${p.rarity}</dd></div>
    <div><dt>Bred as male</dt><dd>${g ? `${Math.round(g.male * 100)}%` : '–'}</dd></div>
  </dl>
  <p class="summary">${summary}</p>
  <div class="btn-row">
    <a class="btn" href="/planner/?t=${p.slug}">${icon('route')}<span>Plan a route</span></a>
    <a class="btn ghost" href="/find/?t=${p.slug}">${icon('check')}<span>Parents I own</span></a>
    <a class="btn ghost" href="/?a=${p.slug}">${icon('egg')}<span>Breed with…</span></a>
  </div>
</header>
${p.collab ? `<p class="note">${icon('info')}<span>Collaboration Pals come from the same game-file data as every other Pal, but their results have not been checked against a second source yet.</span></p>` : ''}
<nav class="jump" aria-label="On this page"><a href="#parents">Parents</a><a href="#offspring">Offspring</a><a href="#stats">Stats</a><a href="#similar">Similar Pals</a></nav>

<section id="parents">
  <h2>Parent pairs that hatch ${name}</h2>
  ${parents.length === 0
    ? `<div class="card">${emptyState('egg', `No pair of different Pals hatches ${name}. Breed a male and a female ${name}.`)}</div>`
    : parents.length <= LIMIT
      ? pairList(parentItems)
      : html`${pairList(parentItems.slice(0, LIMIT))}
<details class="more"><summary>${icon('chevron')}<span>Show all ${parents.length.toLocaleString('en-US')} pairs</span></summary>${pairList(parentItems.slice(LIMIT))}</details>`}
  <p class="muted small">Pairs are listed by Paldeck number. Each pair needs one male and one female.</p>
</section>
${adSlot(config.ads.slots?.inContent)}
<section id="offspring">
  <h2>What ${name} hatches with each Pal</h2>
  <details class="more"><summary>${icon('chevron')}<span>Show the child for all ${offspring.length} partners</span></summary>${pairList(offspringItems)}</details>
</section>

<section id="stats">
  <h2>${name} stats and details</h2>
  <div class="grid-2">
    <div class="card">
      <h3>Base stats</h3>
      ${statBar('HP', p.stats.hp, statMax.hp)}
      ${statBar('Attack', p.stats.attack, statMax.attack)}
      ${statBar('Defense', p.stats.defense, statMax.defense)}
      <dl class="facts">
        <div><dt>Size</dt><dd>${esc(p.size)}</dd></div>
        <div><dt>Food</dt><dd>${p.food}</dd></div>
        <div><dt>Walk / Run</dt><dd>${p.speed.walk} / ${p.speed.run}</dd></div>
        <div><dt>Ride sprint</dt><dd>${p.speed.rideSprint}</dd></div>
        <div><dt>Wild level</dt><dd>${p.wildLevel ? `${p.wildLevel[0]}–${p.wildLevel[1]}` : 'Not in wild data'}</dd></div>
        <div><dt>Breeding rank</dt><dd>${rank + 1} of ${pals.length} <small>(lower power is rarer)</small></dd></div>
        <div><dt>Gender when bred</dt><dd>${g ? `${Math.round(g.male * 100)}% male · ${Math.round(g.female * 100)}% female` : 'Unknown'}</dd></div>
      </dl>
    </div>
    <div class="card">
      <h3>Work suitability</h3>
      ${work.length ? `<ul class="work">${work.map(([w, lv]) => `<li><span>${esc(w)}</span><span class="pips" role="img" aria-label="Level ${lv} of ${workMax}">${Array.from({ length: workMax }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</span><b>Lv ${lv}</b></li>`).join('')}</ul>` : `<p class="muted">${name} has no work suitability.</p>`}
    </div>
  </div>
</section>

<section id="similar">
  <h2>Pals with similar breeding power</h2>
  <p class="muted">Pals close in breeding power often appear as each other's parents or children.</p>
  <p class="chips">${near.map((j) => palLink(pals[j]))}</p>
</section>

<nav class="prev-next" aria-label="More Pals">
  ${prev ? `<a class="card" href="${palPath(prev)}"><small>Previous</small><span>${esc(prev.name)}</span></a>` : '<span></span>'}
  ${next ? `<a class="card next" href="${palPath(next)}"><small>Next</small><span>${esc(next.name)}</span></a>` : '<span></span>'}
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
  body: html`${hero('', 'Page not found', 'That page doesn\'t exist. Try the <a href="/">breeding calculator</a> or the <a href="/pals/">list of all Pals</a>.')}`,
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
