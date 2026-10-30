// Interactive parts of the site. Pages say which part they need with
// <body data-page="...">. Breeding data is loaded once from data.json.

import { childOf, parentsOf, planRoute } from './breeding.js';

const DATA_URL = '__DATA_URL__';
const BASE = ''; // site sub-folder, filled in at build time
const OWNED_KEY = 'eggpair.owned.v1';
const page = document.body.dataset.page;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GENDER = { M: 'male', F: 'female' };

// ---------- My Pals storage (browser only) ----------

function loadOwned() {
  try {
    const v = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]');
    return new Set(Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
  } catch {
    return new Set();
  }
}
function saveOwned(set) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...set]));
    return true;
  } catch {
    return false;
  }
}

// ---------- rendering helpers ----------

function avatar(p, size = '') {
  let h = 0;
  for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initials = p.name.replace(/\(.*\)/, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return `<span class="av ${size}" style="--h:${h}" aria-hidden="true">${esc(initials)}</span>`;
}
const palUrl = (p) => `${BASE}/pals/${p.slug}/`;
const palLink = (p) => `<a class="pal" href="${palUrl(p)}">${avatar(p)}<span>${esc(p.name)}</span></a>`;
const icon = (name) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const sexTag = (g) => (g ? `<span class="sex sex-${g}">${GENDER[g]}</span>` : '');
const emptyState = (ic, text) => `<div class="empty"><svg class="i i-lg" aria-hidden="true"><use href="#i-${ic}"/></svg><p>${text}</p></div>`;
const pairItem = (left, op, right) => `<li class="pair"><span class="side">${left}</span><span class="op">${icon(op)}</span><span class="side">${right}</span></li>`;

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- searchable Pal picker ----------

let pickerCount = 0;

/** Turns <div class="picker" data-label> into a combobox. onChange(index|null). */
function makePicker(el, pals, onChange) {
  const id = `picker-${++pickerCount}`;
  el.innerHTML = `<label for="${id}">${esc(el.dataset.label)}</label>
<input id="${id}" type="text" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search Pal name or #">
<span class="chosen"></span>
<button type="button" class="clear" aria-label="Clear ${esc(el.dataset.label)}">${icon('x')}</button>
<ul id="${id}-list" role="listbox" hidden></ul>`;
  const input = el.querySelector('input');
  const list = el.querySelector('ul');
  const chosen = el.querySelector('.chosen');
  el.querySelector('.clear').addEventListener('click', () => { set(null); input.focus(); });
  let value = null;
  let matches = [];
  let active = -1;

  function search(q) {
    q = q.trim().toLowerCase().replace(/^#0*/, '#');
    if (!q) return pals.map((p, i) => i).slice(0, 60);
    const starts = [], contains = [];
    pals.forEach((p, i) => {
      const n = p.name.toLowerCase();
      const dex = p.dex.toLowerCase().replace(/^#0*/, '#');
      if (n.startsWith(q) || dex === q || dex.startsWith(q)) starts.push(i);
      else if (n.includes(q)) contains.push(i);
    });
    return starts.concat(contains).slice(0, 60);
  }
  function render() {
    list.innerHTML = matches.length
      ? matches.map((i, k) => `<li role="option" id="${id}-o${k}" data-i="${i}" aria-selected="${k === active}">${avatar(pals[i])}<span>${esc(pals[i].name)}</span><small>${esc(pals[i].dex)}</small></li>`).join('')
      : '<li class="empty-opt" role="option" aria-disabled="true">No Pal found. Try another spelling.</li>';
    input.setAttribute('aria-activedescendant', active >= 0 ? `${id}-o${active}` : '');
    const a = list.querySelector('[aria-selected="true"]');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function open() {
    matches = search(value != null && input.value === pals[value].name ? '' : input.value);
    active = matches.length ? 0 : -1;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    render();
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    if (value != null) input.value = pals[value].name;
  }
  function set(i, fire = true) {
    value = i;
    el.classList.toggle('has-value', i != null);
    chosen.innerHTML = i != null ? avatar(pals[i]) : '';
    input.value = i != null ? pals[i].name : '';
    if (fire) onChange(i);
  }

  input.addEventListener('focus', () => { input.select(); open(); });
  input.addEventListener('input', () => {
    if (value != null) { value = null; el.classList.remove('has-value'); chosen.innerHTML = ''; onChange(null); }
    open();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open();
      if (!matches.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      render();
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0) { e.preventDefault(); set(matches[active]); close(); }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // pointerdown so the choice lands before the input loses focus
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    e.preventDefault();
    set(Number(li.dataset.i));
    close();
    input.blur();
  });
  input.addEventListener('blur', () => setTimeout(close, 120));

  return { get: () => value, set };
}

// ---------- URL helpers (shareable links) ----------

const params = new URLSearchParams(location.search);
function indexOfSlug(pals, slug) {
  const i = pals.findIndex((p) => p.slug === slug);
  return i >= 0 ? i : null;
}
function setParams(obj) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(obj)) v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
  history.replaceState(null, '', u);
}

// ---------- pages ----------

function initCalc(data) {
  const { pals } = data;
  const out = document.getElementById('calc-result');
  let a = null, b = null;

  function render() {
    setParams({ a: a != null ? pals[a].slug : null, b: b != null ? pals[b].slug : null });
    if (a == null || b == null) {
      out.innerHTML = emptyState('egg', a == null && b == null ? 'Choose two Pals to see their egg.' : 'Now choose the other parent.');
      return;
    }
    const r = childOf(data, a, b);
    const card = (c, label) => `<a class="child-card" href="${palUrl(pals[c])}">${avatar(pals[c], 'xl')}<span><span class="lbl">${label}</span><b>${esc(pals[c].name)}</b><small>${esc(pals[c].dex)} · breeding power ${pals[c].power}</small></span><span class="go" aria-label="Open ${esc(pals[c].name)}">${icon('arrow')}</span></a>`;
    const head = `<p class="eq">${esc(pals[a].name)} ${icon('plus')} ${esc(pals[b].name)}</p>`;
    if (r.child != null) {
      out.innerHTML = head + card(r.child, a === b ? 'Same species hatches' : 'Hatches');
    } else {
      out.innerHTML = head + '<p class="note">' + icon('info') + '<span>Gender matters for this pair. The egg depends on which parent is male:</span></p><div class="gender-list">' +
        r.byGender.map((o) => card(o.child, `${GENDER[o.ga]} ${esc(pals[o.a].name)} + ${GENDER[o.gb]} ${esc(pals[o.b].name)}`)).join('') + '</div>';
    }
  }

  const pa = makePicker(document.querySelector('[data-role="a"]'), pals, (i) => { a = i; render(); });
  const pb = makePicker(document.querySelector('[data-role="b"]'), pals, (i) => { b = i; render(); });
  document.querySelector('.swap').addEventListener('click', () => {
    [a, b] = [b, a];
    pa.set(a, false);
    pb.set(b, false);
    render();
  });
  a = indexOfSlug(pals, params.get('a'));
  b = indexOfSlug(pals, params.get('b'));
  if (a != null) pa.set(a, false);
  if (b != null) pb.set(b, false);
  render();
}

function initFind(data) {
  const { pals } = data;
  const out = document.getElementById('find-result');
  const onlyOwned = document.getElementById('only-owned');
  const filter = document.getElementById('parent-filter');
  let target = null;
  let shown = 50;

  function render() {
    setParams({ t: target != null ? pals[target].slug : null });
    if (target == null) {
      out.innerHTML = emptyState('search', 'Choose a Pal to list its parents.');
      return;
    }
    const owned = loadOwned();
    const q = filter.value.trim().toLowerCase();
    let pairs = parentsOf(data, target).filter((o) => o.a !== o.b || o.ga);
    const total = pairs.length;
    if (onlyOwned.checked) pairs = pairs.filter((o) => owned.has(pals[o.a].slug) && owned.has(pals[o.b].slug));
    if (q) pairs = pairs.filter((o) => pals[o.a].name.toLowerCase().includes(q) || pals[o.b].name.toLowerCase().includes(q));
    const t = pals[target];
    let msg = `<div class="result-head"><span class="count-badge">${total.toLocaleString('en-US')}</span><span>${total === 1 ? 'pair hatches' : 'pairs hatch'}</span>${palLink(t)}</div>`;
    if (total === 0) msg = emptyState('egg', `${esc(t.name)} only hatches from two ${esc(t.name)} (one male, one female). Catch them in the wild first.`);
    if (onlyOwned.checked && owned.size === 0) msg += `<p class="note">${icon('info')}<span>You haven't marked any Pals yet. Add them on <a href="${BASE}/my-pals/">My Pals</a>.</span></p>`;
    else if ((onlyOwned.checked || q) && total) msg += `<p class="muted">${pairs.length.toLocaleString('en-US')} match your filters.</p>`;
    if ((onlyOwned.checked || q) && total && !pairs.length) msg += emptyState('route', `No pair matches. Try the <a href="${BASE}/planner/?t=${t.slug}">route planner</a> instead.`);
    const items = pairs.slice(0, shown).map((o) => pairItem(`${palLink(pals[o.a])}${sexTag(o.ga)}`, 'plus', `${palLink(pals[o.b])}${sexTag(o.gb)}`)).join('');
    out.innerHTML = msg + (pairs.length ? `<ul class="pairs">${items}</ul>` : '') +
      (pairs.length > shown ? `<p class="btn-row"><button type="button" class="btn ghost" id="more">Show more (${(pairs.length - shown).toLocaleString('en-US')} left)</button></p>` : '');
    const more = document.getElementById('more');
    if (more) more.addEventListener('click', () => { shown += 100; render(); });
  }

  const picker = makePicker(document.querySelector('[data-role="t"]'), pals, (i) => { target = i; shown = 50; render(); });
  onlyOwned.addEventListener('change', () => { shown = 50; render(); });
  filter.addEventListener('input', () => { shown = 50; render(); });
  target = indexOfSlug(pals, params.get('t'));
  if (target != null) picker.set(target, false);
  render();
}

function initPlanner(data) {
  const { pals } = data;
  const out = document.getElementById('plan-result');
  const summary = document.getElementById('owned-summary');
  let target = null;

  function render() {
    setParams({ t: target != null ? pals[target].slug : null });
    const owned = loadOwned();
    const ownedIdx = pals.map((p, i) => (owned.has(p.slug) ? i : -1)).filter((i) => i >= 0);
    summary.innerHTML = ownedIdx.length
      ? `${icon('check')}<span>Planning from <b>${ownedIdx.length}</b> Pals you own.</span> <a href="${BASE}/my-pals/">Edit My Pals</a>`
      : `${icon('info')}<span>You haven't marked any Pals yet.</span> <a href="${BASE}/my-pals/">Add the Pals you own</a>`;
    if (target == null) {
      out.innerHTML = emptyState('route', 'Choose a target Pal.');
      return;
    }
    if (!ownedIdx.length) {
      out.innerHTML = emptyState('check', `Tick the Pals you own on <a href="${BASE}/my-pals/">My Pals</a>, then come back.`);
      return;
    }
    const t = pals[target];
    const plan = planRoute(data, ownedIdx, target);
    if (!plan) {
      out.innerHTML = emptyState('route', `${esc(t.name)} can't be bred from the Pals you own. It may only hatch from two of itself, or need a Pal you don't have yet. See <a href="${palUrl(t)}">all of its parent pairs</a>.`);
      return;
    }
    if (plan.owned) {
      out.innerHTML = emptyState('check', `You already own ${esc(t.name)}. Breed a male and a female for more.`);
      return;
    }
    const n = plan.steps.length;
    out.innerHTML = `<div class="result-head"><span class="count-badge">${n}</span><span>breeding step${n === 1 ? '' : 's'} to</span>${palLink(t)}</div><ol class="steps">` +
      plan.steps.map((s) => `<li><div class="step-card">${palLink(pals[s.a])}${sexTag(s.ga)}<span class="op">${icon('plus')}</span>${palLink(pals[s.b])}${sexTag(s.gb)}<span class="op">${icon('arrow')}</span>${palLink(pals[s.child])}` +
        `${s.ga ? '<small>Gender matters for this pair.</small>' : ''}</div></li>`).join('') + '</ol>' +
      '<p class="muted small">Each step needs one male and one female parent. Pals bred in earlier steps can be reused.</p>';
  }

  const picker = makePicker(document.querySelector('[data-role="t"]'), pals, (i) => { target = i; render(); });
  target = indexOfSlug(pals, params.get('t'));
  if (target != null) picker.set(target, false);
  render();
}

function initMyPals() {
  const list = document.getElementById('my-list');
  const count = document.getElementById('my-count');
  const search = document.getElementById('my-search');
  const boxes = [...list.querySelectorAll('input[type=checkbox]')];
  const total = boxes.length;
  const owned = loadOwned();

  const bar = document.getElementById('my-bar');
  const update = () => {
    count.textContent = `${owned.size} of ${total} owned`;
    bar.style.width = `${(owned.size / total) * 100}%`;
  };
  const persist = () => {
    update();
    if (!saveOwned(owned)) toast('Your browser blocked saving. Ticks will be lost when you leave.');
  };
  for (const b of boxes) {
    b.disabled = false;
    b.checked = owned.has(b.value);
    b.addEventListener('change', () => { b.checked ? owned.add(b.value) : owned.delete(b.value); persist(); });
  }
  update();

  search.addEventListener('input', () => filterList(list, search.value));

  document.getElementById('my-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'eggpair', version: 1, owned: [...owned] }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-pals.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Backup saved with ${owned.size} Pals`);
  });
  document.getElementById('my-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const v = JSON.parse(await file.text());
      const valid = new Set(boxes.map((b) => b.value));
      const slugs = (Array.isArray(v) ? v : v.owned || []).filter((s) => valid.has(s));
      owned.clear();
      slugs.forEach((s) => owned.add(s));
      boxes.forEach((b) => { b.checked = owned.has(b.value); });
      persist();
      toast(`Imported ${owned.size} Pals`);
    } catch {
      toast('That file is not a My Pals backup.');
    }
    e.target.value = '';
  });
  document.getElementById('my-clear').addEventListener('click', () => {
    if (!confirm('Untick all Pals?')) return;
    owned.clear();
    boxes.forEach((b) => { b.checked = false; });
    persist();
    toast('All Pals unticked');
  });
}

/** Hide list items whose name or number doesn't match; extra(li) can hide more. */
function filterList(list, q, extra = () => true) {
  q = q.trim().toLowerCase().replace(/^#0*/, '#');
  let shown = 0;
  for (const li of list.children) {
    const dex = li.dataset.dex.replace(/^#0*/, '#');
    const ok = (!q || li.dataset.name.includes(q) || dex.startsWith(q)) && extra(li);
    li.hidden = !ok;
    if (ok) shown++;
  }
  return shown;
}

function initDirectory() {
  const list = document.getElementById('dir-list');
  const search = document.getElementById('dir-search');
  const chips = [...document.querySelectorAll('.chip-btn')];
  const count = document.getElementById('dir-count');
  let w = '';
  const run = () => {
    const n = filterList(list, search.value, (li) => !w || li.dataset.work.split('|').includes(w));
    count.textContent = `${n} Pal${n === 1 ? '' : 's'}`;
  };
  search.addEventListener('input', run);
  for (const c of chips) {
    c.addEventListener('click', () => {
      w = c.dataset.work;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      run();
    });
  }
}

// ---------- start ----------

async function loadData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const needsData = { calc: initCalc, find: initFind, planner: initPlanner };
if (needsData[page]) {
  loadData().then(needsData[page]).catch(() => {
    const tool = document.querySelector('.tool');
    if (tool) {
      tool.querySelectorAll('.picker:empty').forEach((p) => p.remove());
      tool.insertAdjacentHTML('beforeend', `<p class="note">${icon('info')}<span>The breeding data could not be loaded. Check your connection and reload the page.</span></p>`);
    }
  });
} else if (page === 'mypals') {
  initMyPals();
} else if (page === 'directory') {
  initDirectory();
}
