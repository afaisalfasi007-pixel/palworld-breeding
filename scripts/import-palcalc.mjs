// Converts PalCalc's game-file export into the small data files this site uses.
//
// Usage: node scripts/import-palcalc.mjs <path to a palcalc checkout>
//
// It reads PalCalc.Model/db.json and PalCalc.Model/breeding.json, writes
// data/pals.json, data/breeding.json and data/meta.json, and then checks every
// one of PalCalc's breeding rows against the converted table. If a single row
// disagrees, nothing is written.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pairIndex, childOf } from '../src/lib/breeding.mjs';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-palcalc.mjs <path to palcalc checkout>');
  process.exit(1);
}

const db = JSON.parse(readFileSync(join(src, 'PalCalc.Model/db.json'), 'utf8'));
const raw = JSON.parse(readFileSync(join(src, 'PalCalc.Model/breeding.json'), 'utf8'));

const slugify = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Collab Pals (Terraria) have Paldeck numbers from 10000 upwards in the game data.
const COLLAB_FROM = 10000;

const sorted = [...db.Pals].sort((a, b) =>
  a.Id.PalDexNo - b.Id.PalDexNo || Number(a.Id.IsVariant) - Number(b.Id.IsVariant) || a.InternalName.localeCompare(b.InternalName));

// Two entries can share a display name (Gumoss and its flower form). Keep the
// first as is and name the other after its internal suffix.
const nameCount = {};
for (const p of sorted) nameCount[p.Name] = (nameCount[p.Name] || 0) + 1;

const WORK_NAMES = {
  Kindling: 'Kindling', Watering: 'Watering', Planting: 'Planting', GenerateElectricity: 'Generating Electricity',
  Handiwork: 'Handiwork', Gathering: 'Gathering', Lumbering: 'Lumbering', Mining: 'Mining',
  MedicineProduction: 'Medicine Production', Cooling: 'Cooling', Transporting: 'Transporting', Farming: 'Farming',
};

const usedSlugs = new Set();
const pals = sorted.map((p) => {
  let name = p.Name;
  if (nameCount[p.Name] > 1 && p.Id.IsVariant) {
    const suffix = p.InternalName.split('_').slice(1).join(' ');
    name = `${p.Name} (${suffix})`;
  }
  const slug = slugify(name);
  if (usedSlugs.has(slug)) throw new Error(`Duplicate slug ${slug}`);
  usedSlugs.add(slug);
  const collab = p.Id.PalDexNo >= COLLAB_FROM;
  const work = {};
  for (const [k, v] of Object.entries(p.WorkSuitability || {})) if (v > 0) work[WORK_NAMES[k] || k] = v;
  const g = db.BreedingGenderProbability[p.InternalName] || {};
  return {
    slug,
    name,
    internal: p.InternalName,
    dex: collab ? null : p.Id.PalDexNo,
    variant: p.Id.IsVariant,
    collab,
    power: p.BreedingPower,
    // Tie-breaker when two Pals are equally close to the parents' average.
    priority: p.BreedingPowerPriority,
    rarity: p.Rarity,
    size: p.Size,
    nocturnal: !!p.Nocturnal,
    wildLevel: p.MinWildLevel == null ? null : [p.MinWildLevel, p.MaxWildLevel],
    stats: { hp: p.Hp, attack: p.Attack, defense: p.Defense },
    speed: { walk: p.WalkSpeed, run: p.RunSpeed, rideSprint: p.RideSprintSpeed },
    food: p.FoodAmount,
    work,
    gender: g.MALE == null ? null : { male: g.MALE, female: g.FEMALE },
  };
});

const index = new Map(pals.map((p, i) => [p.internal, i]));
const n = pals.length;
const tri = new Array((n * (n + 1)) / 2).fill(-2); // -2 = not filled yet
const gendered = [];

for (const row of raw.Breeding) {
  const a = index.get(row.Parent1InternalName);
  const b = index.get(row.Parent2InternalName);
  const c = index.get(row.ChildInternalName);
  if (a == null || b == null || c == null) throw new Error(`Unknown Pal in row ${JSON.stringify(row)}`);
  if (row.Parent1Gender === 'WILDCARD' && row.Parent2Gender === 'WILDCARD') {
    const k = pairIndex(a, b);
    if (tri[k] !== -2 && tri[k] !== c) throw new Error(`Conflicting rows for ${row.Parent1InternalName} + ${row.Parent2InternalName}`);
    tri[k] = c;
  } else {
    gendered.push([a, row.Parent1Gender[0], b, row.Parent2Gender[0], c]);
  }
}
// A pair whose result depends on gender has no gender-free row: mark it -1.
for (const [a, , b] of gendered) {
  const k = pairIndex(a, b);
  if (tri[k] !== -2 && tri[k] !== -1) throw new Error('Pair has both a gender-free and a gendered result');
  tri[k] = -1;
}
const missing = tri.filter((v) => v === -2).length;
if (missing) throw new Error(`${missing} parent pairs have no result in the source data`);

const breeding = { pals: n, tri, gendered };

// Check every source row against the converted table, in both parent orders.
const data = { pals, breeding };
let checked = 0;
for (const row of raw.Breeding) {
  const a = index.get(row.Parent1InternalName), b = index.get(row.Parent2InternalName), c = index.get(row.ChildInternalName);
  const ga = row.Parent1Gender === 'WILDCARD' ? null : row.Parent1Gender[0];
  const gb = row.Parent2Gender === 'WILDCARD' ? null : row.Parent2Gender[0];
  for (const [x, gx, y, gy] of [[a, ga, b, gb], [b, gb, a, ga]]) {
    const got = childOf(data, x, y, gx, gy);
    if (got.child !== c) throw new Error(`Mismatch for ${row.Parent1InternalName} + ${row.Parent2InternalName}`);
    checked++;
  }
}

let commit = 'unknown', commitDate = 'unknown';
try {
  [commit, commitDate] = execFileSync('git', ['-C', src, 'log', '-1', '--format=%H%n%cs'], { encoding: 'utf8' }).trim().split('\n');
} catch { /* not a git checkout */ }

const meta = {
  source: 'PalCalc by Tyler Camp',
  sourceUrl: 'https://github.com/tylercamp/palcalc',
  sourceLicense: 'MIT',
  sourceCommit: commit,
  sourceCommitDate: commitDate,
  sourceDbVersion: db.Version,
  gameVersion: 'Palworld 1.0 (game-file export; the source does not name the exact patch)',
  importedOn: new Date().toISOString().slice(0, 10),
  palCount: n,
  pairCount: tri.length,
  genderedCombos: gendered.length,
};

const out = (f, v, pretty) => writeFileSync(resolve('data', f), JSON.stringify(v, null, pretty ? 1 : 0) + '\n');
out('pals.json', pals, true);
out('breeding.json', breeding, false);
out('meta.json', meta, true);
console.log(`Imported ${n} Pals, ${tri.length} parent pairs, ${gendered.length} gender-specific rows; ${checked} source checks passed.`);
