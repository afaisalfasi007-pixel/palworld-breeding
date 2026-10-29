// Breeding lookups shared by the browser and the tests.
//
// `data` is { pals: [...], breeding: { pals, tri, gendered } }:
// - tri holds the child index for every unordered parent pair (see pairIndex),
//   or -1 when the result depends on the parents' genders;
// - gendered lists those exceptions as [a, genderA, b, genderB, child],
//   with genders 'M' or 'F'.

/** Position of the unordered pair (a, b) in the `tri` array. */
export function pairIndex(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return (hi * (hi + 1)) / 2 + lo;
}

/**
 * Child of parents a and b (Pal indexes). Genders are optional ('M'/'F').
 * Returns { child } when the result is fixed. For a gender-dependent pair it
 * returns { child: null, byGender: [{ a, ga, b, gb, child }] } unless matching
 * genders were given, in which case { child, gendered: true }.
 */
export function childOf(data, a, b, ga = null, gb = null) {
  const c = data.breeding.tri[pairIndex(a, b)];
  if (c >= 0) return { child: c };
  const rows = genderedRows(data, a, b);
  if (ga && gb) {
    const hit = rows.find((r) => r.a === a && r.ga === ga && r.b === b && r.gb === gb);
    if (hit) return { child: hit.child, gendered: true };
  }
  return { child: null, byGender: rows };
}

/** Gender-specific rows for the pair, oriented so that the first parent is `a`. */
export function genderedRows(data, a, b) {
  const rows = [];
  for (const [x, gx, y, gy, c] of data.breeding.gendered) {
    if (x === a && y === b) rows.push({ a, ga: gx, b, gb: gy, child: c });
    else if (x === b && y === a) rows.push({ a, ga: gy, b, gb: gx, child: c });
  }
  return rows;
}

/** Every outcome of the pair: one entry, or one per gender combination. */
export function outcomes(data, a, b) {
  const r = childOf(data, a, b);
  if (r.child != null) return [{ a, b, ga: null, gb: null, child: r.child }];
  return r.byGender;
}

/**
 * All parent pairs that produce `target`, each listed once with a <= b
 * (gender-specific entries keep their genders).
 */
export function parentsOf(data, target) {
  const n = data.breeding.pals;
  const tri = data.breeding.tri;
  const out = [];
  for (let b = 0; b < n; b++) {
    const base = (b * (b + 1)) / 2;
    for (let a = 0; a <= b; a++) {
      if (tri[base + a] === target) out.push({ a, b, ga: null, gb: null });
    }
  }
  for (const [x, gx, y, gy, c] of data.breeding.gendered) {
    if (c === target) out.push({ a: x, b: y, ga: gx, gb: gy });
  }
  return out;
}

/** Child of `a` with every Pal (including itself), in Pal order. */
export function offspringWith(data, a) {
  const out = [];
  for (let b = 0; b < data.breeding.pals; b++) out.push(...outcomes(data, a, b).map((o) => ({ ...o, partner: b })));
  return out;
}

/**
 * Fewest breeding steps from the Pals you own to `target`.
 *
 * Each step breeds two Pals you already have (or have bred earlier in the plan).
 * Returns null when the target can't be reached, otherwise
 * { steps: [{ a, b, ga, gb, child }], owned: boolean } with steps in the order
 * to do them. Assumes you can get a male and a female of each parent, which
 * every step needs; gender-specific steps say which parent must be which.
 */
export function planRoute(data, ownedIndexes, target) {
  const n = data.breeding.pals;
  const owned = new Set(ownedIndexes);
  if (owned.has(target)) return { steps: [], owned: true };

  const cost = new Array(n).fill(Infinity);
  const via = new Array(n).fill(null);
  for (const i of owned) cost[i] = 0;

  // Relax until nothing improves. Each round can only lower costs, so this ends.
  let changed = true;
  while (changed) {
    changed = false;
    for (let b = 0; b < n; b++) {
      if (cost[b] === Infinity) continue;
      for (let a = 0; a <= b; a++) {
        if (cost[a] === Infinity || a === b) continue;
        for (const o of outcomes(data, a, b)) {
          const c = o.child;
          const total = cost[a] + cost[b] + 1;
          if (total < cost[c]) {
            cost[c] = total;
            via[c] = o;
            changed = true;
          }
        }
      }
    }
  }
  if (cost[target] === Infinity) return null;

  // Walk the plan parents-first and drop repeats: a Pal bred once can be reused.
  const steps = [];
  const done = new Set(owned);
  (function visit(p) {
    if (done.has(p)) return;
    const o = via[p];
    visit(o.a);
    visit(o.b);
    done.add(p);
    steps.push({ a: o.a, b: o.b, ga: o.ga, gb: o.gb, child: p });
  })(target);
  return { steps, owned: false };
}

/**
 * Child predicted by the usual rule: average the parents' breeding power
 * (rounding up), then pick the nearest Pal, preferring higher priority and then
 * non-variants. Pals in `excluded` (children of special combos) never qualify.
 */
export function formulaChild(pals, a, b, excluded = new Set()) {
  if (a === b) return a;
  const target = Math.floor((pals[a].power + pals[b].power + 1) / 2);
  let best = -1;
  for (let i = 0; i < pals.length; i++) {
    if (excluded.has(i)) continue;
    if (best < 0) { best = i; continue; }
    const d = Math.abs(pals[i].power - target), bd = Math.abs(pals[best].power - target);
    if (d < bd || (d === bd && (pals[i].priority > pals[best].priority ||
        (pals[i].priority === pals[best].priority && !pals[i].variant && pals[best].variant)))) best = i;
  }
  return best;
}

/**
 * How many pairs of two different Pals produce each Pal (gender-specific rows
 * count once each). A Pal with a count of 0 can only come from two of itself.
 */
export function recipeCounts(data) {
  const n = data.breeding.pals;
  const counts = new Array(n).fill(0);
  for (let b = 0; b < n; b++) {
    for (let a = 0; a < b; a++) for (const o of outcomes(data, a, b)) counts[o.child]++;
  }
  return counts;
}
