// Inline SVG icon sprite. Each page embeds it once; use icon('name') anywhere,
// including in browser-rendered HTML (<svg class="i"><use href="#i-name"/></svg>).

const paths = {
  egg: '<path d="M12 3c-3.6 0-6.5 5.4-6.5 10.2a6.5 6.5 0 0 0 13 0C18.5 8.4 15.6 3 12 3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  route: '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="m8 12.2 2.8 2.8L16.2 9"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  swap: '<path d="M7 20V4M7 4 3.5 7.5M7 4l3.5 3.5M17 4v16m0 0-3.5-3.5M17 20l3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  equals: '<path d="M5 9h14M5 15h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4.5 19.5h15"/>',
  upload: '<path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 19.5h15"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v15h-13a2 2 0 0 0-2 2zM4.5 20.5v-15"/>',
  sparkle: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  x: '<path d="M6.5 6.5l11 11m0-11-11 11"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};

export const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${Object.entries(paths)
  .map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`)
  .join('')}</svg>`;

export const icon = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

/** Logo: an egg with a crack, in the brand colours. */
export const logo = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 2.5c-5.6 0-10.5 8.6-10.5 16.1a10.5 10.5 0 0 0 21 0C26.5 11.1 21.6 2.5 16 2.5z" fill="var(--brand)"/><path d="m8 18 3.2-2.6 3 2.6 3.4-3 3 3 3.2-2.6" fill="none" stroke="var(--brand-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
