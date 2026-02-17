import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router";
import { Toaster } from "sileo";

import { useHostRedirect } from "@/hooks/use-host-redirect";

import { HomePage } from "./features/home/home-page";
import { cn } from "./lib/utils";

const FramerPage = lazy(() =>
  import("./features/framer/framer-page").then((module) => ({
    default: module.FramerPage,
  })),
);
const PosterPage = lazy(() =>
  import("./features/poster/poster-page").then((module) => ({
    default: module.PosterPage,
  })),
);
const NepaliPdfPage = lazy(() =>
  import("./features/nepali-pdf/nepali-pdf-page").then((module) => ({
    default: module.NepaliPdfPage,
  })),
);
const FbFramePage = lazy(() =>
  import("./features/fb-frame/fb-frame-page").then((module) => ({
    default: module.FbFramePage,
  })),
);

function RouteFallback() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">Loading tool…</p>
    </main>
  );
}

function AppRoutes() {
  useHostRedirect();

  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route
        element={
          <Suspense fallback={<RouteFallback />}>
            <FramerPage />
          </Suspense>
        }
        path="/framer"
      />
      <Route
        element={
          <Suspense fallback={<RouteFallback />}>
            <PosterPage />
          </Suspense>
        }
        path="/poster"
      />
      <Route
        element={
          <Suspense fallback={<RouteFallback />}>
            <NepaliPdfPage />
          </Suspense>
        }
        path="/nepali-pdf"
      />
      <Route
        element={
          <Suspense fallback={<RouteFallback />}>
            <FbFramePage />
          </Suspense>
        }
        path="/fb-frame"
      />
    </Routes>
  );
}

function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav className="flex h-14 shrink-0 items-center border-b bg-background px-4 sm:px-6">
      <Link
        className="flex items-center gap-3 font-semibold text-lg tracking-tight"
        to="/"
      >
        <img alt="brihatools" className="h-8 w-auto" src="/favicon.svg" />
        <span>brihatools</span>
      </Link>

      {!isHome && (
        <Link
          className={cn(
            "ml-auto text-muted-foreground text-sm transition-colors hover:text-foreground",
          )}
          to="/"
        >
          All Tools
        </Link>
      )}
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <AppHeader />
        <AppRoutes />
      </div>
      <Toaster
        offset={16}
        options={{
          roundness: 12,
        }}
        position="top-center"
      />
    </BrowserRouter>
  );
}
