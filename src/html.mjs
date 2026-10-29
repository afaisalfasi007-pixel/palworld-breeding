// Small HTML helpers and the shared page layout.

import config from '../site.config.mjs';
import { sprite, icon, logo } from './icons.mjs';

export { icon };

/** Escape text for HTML content and attribute values. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tagged template that leaves nested html`` results and arrays untouched. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += Array.isArray(v) ? v.join('') : v == null || v === false ? '' : String(v);
    out += strings[i + 1];
  });
  return out;
}

export const absUrl = (path) => config.url + path;

export const palPath = (p) => `/pals/${p.slug}/`;

export function dexLabel(p) {
  if (p.collab) return 'Collab';
  return `#${String(p.dex).padStart(3, '0')}${p.variant ? 'B' : ''}`;
}

/** Coloured initials badge; the hue comes from the name so it is stable. */
export function avatar(p, size = '') {
  let h = 0;
  for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initials = p.name.replace(/\(.*\)/, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return `<span class="av ${size}" style="--h:${h}" aria-hidden="true">${esc(initials)}</span>`;
}

/** Pal name as a link with its badge. */
export function palLink(p) {
  return `<a class="pal" href="${palPath(p)}">${avatar(p)}<span>${esc(p.name)}</span></a>`;
}

const NAV = [
  ['/', 'Calculator', 'egg'],
  ['/find/', 'Find', 'search'],
  ['/planner/', 'Planner', 'route'],
  ['/my-pals/', 'My Pals', 'check'],
  ['/pals/', 'All Pals', 'grid'],
];

/** A display ad slot. Renders nothing until ads are switched on in site.config.mjs. */
export function adSlot(slotId) {
  if (!config.ads.enabled || !config.ads.adsenseClient || !slotId) return '';
  return html`<div class="ad" aria-label="Advertisement"><span class="ad-label">Advertisement</span>
<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(config.ads.adsenseClient)}" data-ad-slot="${esc(slotId)}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

/**
 * Full page. `page` = { path, title, description, body, jsonLd?, scripts?,
 * pageType?, noindex?, meta } where meta is data/meta.json.
 */
export function layout(page, assets) {
  const canonical = absUrl(page.path);
  const title = page.title.includes(config.name) ? page.title : `${page.title} | ${config.name}`;
  const ld = (page.jsonLd || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  const isCurrent = (href) => (href === '/' ? page.path === '/' : page.path.startsWith(href));
  const topNav = NAV.map(([href, label]) => `<a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const tabNav = NAV.map(([href, label, ic]) => `<a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  const m = page.meta;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${canonical}">
${page.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#f4f6fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0f1c" media="(prefers-color-scheme: dark)">
${config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${assets.css}">
${ld}
${config.ads.enabled && config.ads.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.ads.adsenseClient)}" crossorigin="anonymous"></script>` : ''}
</head>
<body data-page="${page.pageType || 'static'}">
${sprite}
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/">${logo}<span class="brand-name">${esc(config.name)}</span><span class="brand-sub">Palworld breeding</span></a>
    <nav class="top-nav" aria-label="Main">${topNav}</nav>
  </div>
</header>
<main id="main" class="wrap">
${page.body}
</main>
<footer class="foot">
  <div class="wrap">
    <p class="data-line">${icon('info')}<span>Breeding data: ${esc(m.gameVersion)} · source <a href="/data-sources/">${esc(m.source)}</a> (DB ${esc(m.sourceDbVersion)}, ${esc(m.sourceCommitDate)}) · ${m.palCount} Pals.</span></p>
    <nav class="foot-links" aria-label="Site">
      <a href="/guide/how-breeding-works/">How breeding works</a>
      <a href="/about/">About</a>
      <a href="/data-sources/">Data sources</a>
      <a href="/privacy/">Privacy</a>
      <a href="/contact/">Contact</a>
      <a href="/disclaimer/">Disclaimer</a>
    </nav>
    <p class="fine">${esc(config.name)} is an unofficial fan tool. It is not affiliated with or endorsed by Pocketpair. Palworld and all related names are trademarks of their owners.</p>
  </div>
</footer>
<nav class="tabbar" aria-label="Main (mobile)">${tabNav}</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
${page.scripts ? `<script type="module" src="${assets.js}"></script>` : ''}
${config.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: config.cloudflareAnalyticsToken })}'></script>` : ''}
</body>
</html>
`;
}

export function breadcrumbs(items) {
  const nav = html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([href, label], i) =>
    i === items.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${href}">${esc(label)}</a></li>`)}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: label, item: absUrl(href) })),
  };
  return { nav, ld };
}
