import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { childOf, parentsOf, planRoute, outcomes, formulaChild, recipeCounts, pairIndex } from '../src/lib/breeding.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const pals = read('pals.json');
const breeding = read('breeding.json');
const meta = read('meta.json');
const data = { pals, breeding };
const I = (name) => {
  const i = pals.findIndex((p) => p.name === name);
  assert.ok(i >= 0, `unknown Pal ${name}`);
  return i;
};
const child = (a, b) => pals[childOf(data, I(a), I(b)).child]?.name;

test('data files agree with each other', () => {
  const n = pals.length;
  assert.equal(breeding.pals, n);
  assert.equal(breeding.tri.length, (n * (n + 1)) / 2);
  assert.equal(meta.palCount, n);
  assert.equal(meta.sourceLicense, 'MIT');
  assert.ok(meta.gameVersion && meta.sourceCommit && meta.sourceDbVersion);
  for (const c of breeding.tri) assert.ok(Number.isInteger(c) && c >= -1 && c < n);
  for (const [a, ga, b, gb, c] of breeding.gendered) {
    assert.equal(breeding.tri[pairIndex(a, b)], -1);
    assert.ok(['M', 'F'].includes(ga) && ['M', 'F'].includes(gb) && c >= 0 && c < n);
  }
  assert.equal(new Set(pals.map((p) => p.slug)).size, n, 'slugs are unique');
  for (const p of pals) assert.match(p.slug, /^[a-z0-9-]+$/);
});

test('pairIndex is symmetric and covers every slot once', () => {
  const seen = new Set();
  for (let b = 0; b < 30; b++) for (let a = 0; a <= b; a++) {
    assert.equal(pairIndex(a, b), pairIndex(b, a));
    seen.add(pairIndex(a, b));
  }
  assert.equal(seen.size, (30 * 31) / 2);
  assert.equal(Math.max(...seen), seen.size - 1);
});

test('same species always breeds true', () => {
  for (let i = 0; i < pals.length; i++) assert.equal(childOf(data, i, i).child, i);
});

test('known results, cross-checked with other 1.0 sources', () => {
  assert.equal(child('Relaxaurus', 'Sparkit'), 'Relaxaurus Lux');
  assert.equal(child('Sparkit', 'Relaxaurus'), 'Relaxaurus Lux');
  assert.equal(child('Penking', 'Bushi'), 'Sibelyx'); // older guides said Anubis
  assert.equal(child('Lamball', 'Cattiva'), 'Daedream');
  assert.equal(child('Chikipi', 'Lamball'), 'Teafant');
});

test('Katress + Wixen depends on gender', () => {
  const k = I('Katress'), w = I('Wixen');
  assert.equal(childOf(data, k, w).child, null);
  assert.equal(pals[childOf(data, k, w, 'F', 'M').child].name, 'Katress Ignis');
  assert.equal(pals[childOf(data, k, w, 'M', 'F').child].name, 'Wixen Noct');
  assert.equal(pals[childOf(data, w, k, 'M', 'F').child].name, 'Katress Ignis');
  assert.equal(outcomes(data, k, w).length, 2);
});

test('legendaries only come from two of themselves', () => {
  const counts = recipeCounts(data);
  for (const name of ['Jetragon', 'Frostallion', 'Shadowbeak', 'Necromus', 'Paladius']) {
    assert.equal(counts[I(name)], 0, name);
    assert.deepEqual(parentsOf(data, I(name)).map((o) => [o.a, o.b]), [[I(name), I(name)]]);
  }
});

test('every regular result follows the breeding-power rule', () => {
  // Pals with four or fewer recipes are special-combo children (or never bred
  // from other Pals); the game leaves them out of the normal rule.
  const counts = recipeCounts(data);
  const special = new Set(counts.map((c, i) => (c <= 4 ? i : -1)).filter((i) => i >= 0));
  let checked = 0;
  for (let b = 0; b < pals.length; b++) {
    for (let a = 0; a < b; a++) {
      if (pals[a].collab || pals[b].collab) continue; // collab Pals: not cross-checked
      for (const o of outcomes(data, a, b)) {
        if (special.has(o.child)) continue;
        assert.equal(o.child, formulaChild(pals, a, b, special), `${pals[a].name} + ${pals[b].name}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 30000, `checked ${checked}`);
});

test('parentsOf lists each pair once and matches childOf', () => {
  const t = I('Anubis');
  const pairs = parentsOf(data, t);
  assert.ok(pairs.length > 10);
  const keys = new Set(pairs.map((o) => `${o.a}-${o.b}-${o.ga}`));
  assert.equal(keys.size, pairs.length);
  for (const o of pairs) assert.equal(childOf(data, o.a, o.b, o.ga, o.gb).child, t);
});

test('planner: already owned, one step, impossible, multi-step', () => {
  assert.deepEqual(planRoute(data, [I('Lamball')], I('Lamball')), { steps: [], owned: true });

  const one = planRoute(data, [I('Lamball'), I('Cattiva')], I('Daedream'));
  assert.equal(one.steps.length, 1);

  assert.equal(planRoute(data, [I('Lamball'), I('Cattiva')], I('Jetragon')), null);

  const owned = ['Lamball', 'Cattiva', 'Chikipi', 'Foxparks', 'Pengullet', 'Relaxaurus', 'Sparkit'].map(I);
  const plan = planRoute(data, owned, I('Anubis'));
  assert.ok(plan && plan.steps.length > 0);
  // Every step only uses Pals that are owned or bred earlier, and the last step makes the target.
  const have = new Set(owned);
  for (const s of plan.steps) {
    assert.ok(have.has(s.a) && have.has(s.b), 'parents available');
    assert.equal(childOf(data, s.a, s.b, s.ga, s.gb).child, s.child);
    have.add(s.child);
  }
  assert.equal(plan.steps.at(-1).child, I('Anubis'));
});

test('planner handles gender-specific steps', () => {
  const plan = planRoute(data, [I('Katress'), I('Wixen')], I('Katress Ignis'));
  assert.equal(plan.steps.length, 1);
  const s = plan.steps[0];
  assert.equal(childOf(data, s.a, s.b, s.ga, s.gb).child, I('Katress Ignis'));
});
