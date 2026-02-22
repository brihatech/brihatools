export type PosterCategory =
  | "All"
  | "Chunna Poudel"
  | "Binod Chaudhary"
  | "Vote Chunnu";

export type PosterRealCategory = Exclude<PosterCategory, "All">;

const matchesDomain = (hostname: string, domain: string) => {
  const host = hostname.toLowerCase();
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
};

const DEFAULT_CATEGORY_RULES: Array<{
  category: PosterCategory;
  domains: readonly string[];
}> = [
  {
    category: "Vote Chunnu",
    domains: ["vote.chunnapoudel.com"],
  },
  {
    category: "Chunna Poudel",
    domains: ["chunnapoudel.com"],
  },
  {
    category: "Binod Chaudhary",
    domains: ["binodformp.com", "binodchaudharyformp.com"],
  },
] as const;

export const getDefaultPosterCategoryForHostname = (
  hostname: string,
): PosterCategory => {
  // Allow overriding hostname via ?host= query param during development
  if (import.meta.env.DEV) {
    const hostOverride = new URLSearchParams(window.location.search).get(
      "host",
    );
    if (hostOverride) hostname = hostOverride;
  }

  for (const rule of DEFAULT_CATEGORY_RULES) {
    for (const domain of rule.domains) {
      if (matchesDomain(hostname, domain)) {
        return rule.category;
      }
    }
  }

  return "All";
};
