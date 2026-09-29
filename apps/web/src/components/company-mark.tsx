"use client";

import { useState } from "react";

type CompanyMarkProps = {
  company: string;
  size?: "sm" | "md";
};

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-xl text-sm",
  md: "h-10 w-10 rounded-lg text-base",
} as const;

// Employers in the approved catalog. Explicit domains avoid mistaking an ATS
// host for the employer or guessing domains such as notion.com and toast.com.
const COMPANY_DOMAINS: Record<string, string> = {
  "1password": "1password.com",
  affirm: "affirm.com",
  airbnb: "airbnb.com",
  airtable: "airtable.com",
  amplitude: "amplitude.com",
  anthropic: "anthropic.com",
  asana: "asana.com",
  benchling: "benchling.com",
  block: "block.xyz",
  brex: "brex.com",
  carta: "carta.com",
  chime: "chime.com",
  cloudflare: "cloudflare.com",
  cohere: "cohere.com",
  coinbase: "coinbase.com",
  cursor: "cursor.com",
  databricks: "databricks.com",
  datadog: "datadoghq.com",
  discord: "discord.com",
  doordash: "doordash.com",
  dropbox: "dropbox.com",
  duolingo: "duolingo.com",
  elastic: "elastic.co",
  elevenlabs: "elevenlabs.io",
  faire: "faire.com",
  figma: "figma.com",
  flexport: "flexport.com",
  gemini: "gemini.com",
  gitlab: "gitlab.com",
  gusto: "gusto.com",
  harvey: "harvey.ai",
  hex: "hex.tech",
  hootsuite: "hootsuite.com",
  instacart: "instacart.com",
  intercom: "intercom.com",
  jumpcloud: "jumpcloud.com",
  klaviyo: "klaviyo.com",
  kraken: "kraken.com",
  lattice: "lattice.com",
  lemonade: "lemonade.com",
  linear: "linear.app",
  lyft: "lyft.com",
  mixpanel: "mixpanel.com",
  modal: "modal.com",
  mongodb: "mongodb.com",
  notion: "notion.so",
  nuro: "nuro.ai",
  okta: "okta.com",
  openai: "openai.com",
  outreach: "outreach.io",
  pagerduty: "pagerduty.com",
  palantir: "palantir.com",
  perplexity: "perplexity.ai",
  pinterest: "pinterest.com",
  plaid: "plaid.com",
  posthog: "posthog.com",
  quora: "quora.com",
  ramp: "ramp.com",
  reddit: "reddit.com",
  replit: "replit.com",
  ro: "ro.co",
  robinhood: "robinhood.com",
  roblox: "roblox.com",
  runway: "runwayml.com",
  scaleai: "scale.com",
  samsara: "samsara.com",
  sierra: "sierra.ai",
  snowflake: "snowflake.com",
  sofi: "sofi.com",
  spotify: "spotify.com",
  squarespace: "squarespace.com",
  stripe: "stripe.com",
  supabase: "supabase.com",
  toast: "toasttab.com",
  twitch: "twitch.tv",
  twilio: "twilio.com",
  vanta: "vanta.com",
  vercel: "vercel.com",
  watershed: "watershed.com",
  waymo: "waymo.com",
  wealthfront: "wealthfront.com",
  wealthsimple: "wealthsimple.com",
  webflow: "webflow.com",
  zapier: "zapier.com",
  zoox: "zoox.com",
  zscaler: "zscaler.com",
};

function companyMonogram(company: string): string {
  return company.trim().charAt(0).toUpperCase() || "?";
}

function companyIconSlug(company: string): string {
  return company
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function companyIconUrl(company: string): string | null {
  const slug = companyIconSlug(company);
  if (!slug) return null;
  const domain = COMPANY_DOMAINS[slug];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`;
  }
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}?viewbox=auto`;
}

function CompanyMark({ company, size = "md" }: CompanyMarkProps) {
  const slug = companyIconSlug(company);
  const iconUrl = companyIconUrl(company);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);

  return (
    <span
      aria-hidden="true"
      data-company-mark={company}
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-accent-soft font-semibold text-accent ${SIZE_CLASSES[size]}`}
    >
      {iconUrl && failedSlug !== slug ? (
        // Catalog companies use their website favicon; other brands try the
        // Simple Icons CDN. A failed request falls back to the initial below.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          data-company-logo={company}
          referrerPolicy="no-referrer"
          className="h-[62%] w-[62%] object-contain"
          onError={() => setFailedSlug(slug)}
        />
      ) : (
        companyMonogram(company)
      )}
    </span>
  );
}

export { CompanyMark, companyIconSlug, companyIconUrl, companyMonogram };
