type CompanyMarkProps = {
  company: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-xl text-sm",
  md: "h-10 w-10 rounded-lg text-base",
  lg: "h-14 w-14 rounded-xl text-lg",
} as const;

const LOCAL_COMPANY_ICONS: Record<string, string> = {
  airbnb: "#FF5A5F",
  airtable: "#18BFFF",
  anthropic: "#191919",
  asana: "#F06A6A",
  cloudflare: "#F38020",
  coinbase: "#0052FF",
  databricks: "#FF3621",
  datadog: "#632CA6",
  discord: "#5865F2",
  doordash: "#FF3008",
  dropbox: "#0061FF",
  duolingo: "#58CC02",
  elastic: "#005571",
  figma: "#F24E1E",
  gitlab: "#FC6D26",
  instacart: "#43B02A",
  intercom: "#6AFDEF",
  linear: "#5E6AD2",
  lyft: "#FF00BF",
  mongodb: "#47A248",
  notion: "#000000",
  okta: "#007DC1",
  palantir: "#101113",
  pinterest: "#BD081C",
  reddit: "#FF4500",
  replit: "#F26207",
  robinhood: "#CCFF00",
  roblox: "#000000",
  snowflake: "#29B5E8",
  spotify: "#1ED760",
  stripe: "#635BFF",
  supabase: "#3FCF8E",
  tesla: "#CC0000",
  twitch: "#9146FF",
  vercel: "#000000",
  webflow: "#146EF5",
  zapier: "#FF4F00",
};

// Every employer in the current Greenhouse, Lever, and Ashby catalog has a
// bundled website icon. Keeping these same-origin avoids leaking the user's
// job browsing to a logo service at render time.
const LOCAL_COMPANY_LOGOS = new Set([
  "1password",
  "affirm",
  "airbnb",
  "airtable",
  "amplitude",
  "anthropic",
  "asana",
  "benchling",
  "block",
  "brex",
  "carta",
  "chime",
  "cloudflare",
  "cohere",
  "coinbase",
  "cursor",
  "databricks",
  "datadog",
  "discord",
  "doordash",
  "dropbox",
  "duolingo",
  "elastic",
  "elevenlabs",
  "faire",
  "figma",
  "flexport",
  "gemini",
  "gitlab",
  "gusto",
  "harvey",
  "hex",
  "hootsuite",
  "instacart",
  "intercom",
  "jumpcloud",
  "klaviyo",
  "kraken",
  "lattice",
  "lemonade",
  "linear",
  "lyft",
  "mixpanel",
  "modal",
  "mongodb",
  "notion",
  "nuro",
  "okta",
  "openai",
  "outreach",
  "pagerduty",
  "palantir",
  "perplexity",
  "pinterest",
  "plaid",
  "posthog",
  "quora",
  "ramp",
  "reddit",
  "replit",
  "ro",
  "robinhood",
  "roblox",
  "runway",
  "samsara",
  "scaleai",
  "sierra",
  "snowflake",
  "sofi",
  "spotify",
  "squarespace",
  "stripe",
  "supabase",
  "toast",
  "twilio",
  "twitch",
  "vanta",
  "vercel",
  "watershed",
  "waymo",
  "wealthfront",
  "wealthsimple",
  "webflow",
  "zapier",
  "zoox",
  "zscaler",
]);

const DARK_LOGO_TILES = new Set(["chime", "samsara"]);

function companyMonogram(company: string): string {
  return company.trim().charAt(0).toUpperCase() || "?";
}

function companyIconKey(company: string): string {
  return company
    .normalize("NFKD")
    .toLowerCase()
    .replace(
      /\b(incorporated|corporation|company|limited|holdings|labs?|inc|corp|co|ltd|llc)\b\.?/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
}

function CompanyMark({ company, size = "md" }: CompanyMarkProps) {
  const key = companyIconKey(company);
  const brandColor = LOCAL_COMPANY_ICONS[key];
  const icon = brandColor ? key : null;
  const logo = LOCAL_COMPANY_LOGOS.has(key) ? key : null;
  const maskUrl = icon ? `url(/company-icons/${icon}.svg)` : undefined;

  return (
    <span
      aria-hidden="true"
      data-company-mark={company}
      data-company-icon={logo ?? icon ?? undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface font-semibold text-accent shadow-sm ${SIZE_CLASSES[size]}`}
    >
      {logo ? (
        <span
          className={`h-[72%] w-[72%] bg-contain bg-center bg-no-repeat ${
            DARK_LOGO_TILES.has(logo) ? "rounded-lg bg-[#111111]" : ""
          }`}
          style={{ backgroundImage: `url(/company-logos/${logo}.png)` }}
        />
      ) : icon ? (
        <span
          className="h-[68%] w-[68%]"
          style={{
            backgroundColor: brandColor,
            maskImage: maskUrl,
            WebkitMaskImage: maskUrl,
            maskPosition: "center",
            WebkitMaskPosition: "center",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskSize: "contain",
          }}
        />
      ) : (
        companyMonogram(company)
      )}
    </span>
  );
}

export { CompanyMark, companyIconKey, companyMonogram };
