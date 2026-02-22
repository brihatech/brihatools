export const POSTER_ONLY_HOSTS = new Set([
  "tools.chunnapoudel.com",
  "vote.chunnapoudel.com",
  "tools.binodformp.com",
  "tools.binodchaudhary.com",
]);

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

export function isPosterOnlyHost(hostname: string): boolean {
  return POSTER_ONLY_HOSTS.has(hostname.toLowerCase());
}

export function enforcePosterOnlyHosts(): void {
  if (typeof window === "undefined") return;

  const host = window.location.hostname.toLowerCase();
  if (!isPosterOnlyHost(host)) return;

  const pathname = normalizePathname(window.location.pathname);
  if (pathname === "/poster") return;

  const target = `/poster${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}
