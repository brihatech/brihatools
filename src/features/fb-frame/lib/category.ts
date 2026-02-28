export type FbFrameCategory = "All" | "Chunna Poudel" | "Binod Chaudhary";

export type FbFrameRealCategory = Exclude<FbFrameCategory, "All">;

const matchesDomain = (hostname: string, domain: string) => {
  const host = hostname.toLowerCase();
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
};

const DEFAULT_CATEGORY_RULES: Array<{
  category: FbFrameCategory;
  domains: readonly string[];
}> = [
  {
    category: "Chunna Poudel",
    domains: ["chunnapoudel.com"],
  },
  {
    category: "Binod Chaudhary",
    domains: [
      "binodformp.com",
      "binodchaudhary.com",
      "binodchaudharyformp.com",
    ],
  },
] as const;

export const getDefaultFbFrameCategoryForHostname = (
  hostname: string,
): FbFrameCategory => {
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
