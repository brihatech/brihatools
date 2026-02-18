export type PosterCategory = "All" | "Chunna Poudel" | "Binod Chaudhary";

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
  for (const rule of DEFAULT_CATEGORY_RULES) {
    for (const domain of rule.domains) {
      if (matchesDomain(hostname, domain)) {
        return rule.category;
      }
    }
  }

  return "All";
};
