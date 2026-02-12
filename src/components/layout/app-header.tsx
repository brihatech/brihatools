import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";

export function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav className="flex h-14 shrink-0 items-center border-slate-800 border-b bg-slate-900 px-4 text-white sm:px-6">
      <Link
        className="flex items-center gap-3 font-semibold text-lg tracking-tight"
        to="/"
      >
        <img alt="Brihatech" className="h-8 w-auto" src="/brihatech.svg" />
        <span>brihatools</span>
      </Link>

      {!isHome && (
        <Link
          className={cn(
            "ml-auto text-sm text-white/70 transition-colors hover:text-white",
          )}
          to="/"
        >
          All Tools
        </Link>
      )}
    </nav>
  );
}
