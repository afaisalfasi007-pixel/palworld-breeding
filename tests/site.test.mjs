// Checks the built site in dist/. Run `npm run build` first (`npm run check` does both).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import config from '../site.config.mjs';

const dist = new URL('../dist/', import.meta.url).pathname;
const built = existsSync(join(dist, 'index.html'));

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? htmlFiles(p) : f.endsWith('.html') ? [p] : [];
  });
}
const pathOf = (file) => '/' + relative(dist, file).replace(/index\.html$/, '');
const pages = built ? htmlFiles(dist).map((f) => ({ file: f, path: pathOf(f), html: readFileSync(f, 'utf8') })) : [];
const base = new URL(config.url).pathname.replace(/\/$/, '');
const get = (html, re) => (html.match(re) || [])[1];

test('site was built', { skip: !built && 'run npm run build first' }, () => {
  assert.ok(pages.length > 300);
});

test('every page has a title, description, canonical and one h1', { skip: !built }, () => {
  for (const p of pages) {
    const title = get(p.html, /<title>([^<]*)<\/title>/);
    const desc = get(p.html, /<meta name="description" content="([^"]*)"/);
    assert.ok(title && title.length >= 10 && title.length <= 90, `${p.path} title "${title}"`);
    assert.ok(desc && desc.length >= 50 && desc.length <= 200, `${p.path} description length ${desc?.length}`);
    assert.equal((p.html.match(/<h1[\s>]/g) || []).length, 1, `${p.path} h1 count`);
    if (p.path !== '/404.html') {
      assert.equal(get(p.html, /<link rel="canonical" href="([^"]*)"/), config.url + p.path, `${p.path} canonical`);
    }
  }
});

test('titles and descriptions are unique', { skip: !built }, () => {
  for (const what of [/<title>([^<]*)<\/title>/, /<meta name="description" content="([^"]*)"/]) {
    const seen = new Map();
    for (const p of pages) {
      const v = get(p.html, what);
      assert.ok(!seen.has(v), `duplicate "${v}" on ${p.path} and ${seen.get(v)}`);
      seen.set(v, p.path);
    }
  }
});

test('internal links point to pages that exist', { skip: !built }, () => {
  const existing = new Set(pages.map((p) => p.path));
  for (const p of pages) {
    for (const [, href] of p.html.matchAll(/href="(\/[^"]*)"/g)) {
      let path = href.split(/[?#]/)[0];
      if (base) {
        assert.ok(path.startsWith(base + '/'), `${p.path} link ${href} is missing the base path`);
        path = path.slice(base.length);
      }
      if (path.startsWith('/assets/') || /\.(svg|xml|txt)$/.test(path)) {
        assert.ok(existsSync(join(dist, path)), `${p.path} → ${href}`);
      } else {
        assert.ok(existing.has(path), `${p.path} links to missing ${href}`);
      }
    }
  }
});

test('sitemap lists every indexable page and robots.txt points to it', { skip: !built }, () => {
  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]));
  const indexable = pages.filter((p) => p.path !== '/404.html' && !p.html.includes('content="noindex"'));
  assert.equal(locs.size, indexable.length);
  for (const p of indexable) assert.ok(locs.has(config.url + p.path), `${p.path} missing from sitemap`);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), new RegExp(`Sitemap: ${config.url}/sitemap.xml`));
});

test('structured data is valid JSON', { skip: !built }, () => {
  for (const p of pages) {
    for (const [, json] of p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const v = JSON.parse(json);
      assert.equal(v['@context'], 'https://schema.org', p.path);
    }
  }
});

test('every page shows the data version and the unofficial notice', { skip: !built }, () => {
  for (const p of pages) {
    assert.match(p.html, /Breeding data: Palworld/, p.path);
    assert.match(p.html, /not affiliated with or endorsed by Pocketpair/, p.path);
  }
});

test('no ads or analytics load unless configured', { skip: !built }, () => {
  const home = pages.find((p) => p.path === '/').html;
  if (!config.ads.enabled) assert.doesNotMatch(home, /adsbygoogle/);
  if (!config.cloudflareAnalyticsToken) assert.doesNotMatch(home, /cloudflareinsights/);
});
