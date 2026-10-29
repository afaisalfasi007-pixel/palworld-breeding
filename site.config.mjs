// Site settings. Change these here; every page reads them at build time.
export default {
  name: 'EggPair',
  tagline: 'Palworld Breeding Calculator',

  // Full address of the live site, no trailing slash. Used for canonical URLs,
  // the sitemap and structured data. The SITE_URL environment variable wins,
  // so Cloudflare Pages can set it without editing this file.
  url: process.env.SITE_URL || 'https://palworld-breeding.pages.dev',

  // Public contact address shown on the Contact page. Leave empty until you
  // have one you want to publish (ad networks expect a way to contact you).
  contactEmail: process.env.CONTACT_EMAIL || '',

  // Cloudflare Web Analytics token (free, no cookies). Empty = no analytics.
  cloudflareAnalyticsToken: process.env.CF_ANALYTICS_TOKEN || '',

  // Google Search Console HTML-tag verification code (the content="..." value).
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || '',

  // Ads stay off until an ad network has approved the site. When approved, set
  // the publisher ID (for AdSense, "ca-pub-…") and turn ads on.
  ads: {
    enabled: process.env.ADS_ENABLED === 'true',
    adsenseClient: process.env.ADSENSE_CLIENT || '',
    // Ad unit IDs from the ad network. A slot with no ID shows nothing.
    slots: {
      belowTool: process.env.AD_SLOT_BELOW_TOOL || '',
      inContent: process.env.AD_SLOT_IN_CONTENT || '',
    },
  },

  // Affiliate links: add only real links from programmes you have joined.
  // Each entry: { label, url, note }. Shown on the Pal pages with a disclosure.
  affiliates: [],
};
