const POSTER_ONLY_HOSTS = new Set([
  "tools.chunnapoudel.com",
  "tools.binodformp.com",
  "tools.binodchaudhary.com",
]);

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

export function enforcePosterOnlyHosts(): void {
  if (typeof window === "undefined") return;

  const host = window.location.hostname.toLowerCase();
  if (!POSTER_ONLY_HOSTS.has(host)) return;

  const pathname = normalizePathname(window.location.pathname);
  if (pathname === "/poster.html") return;

  const target = `/poster.html${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}
