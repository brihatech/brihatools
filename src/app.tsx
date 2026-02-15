import { BrowserRouter, Route, Routes } from "react-router";

import { AppHeader } from "@/components/layout/app-header";
import { useHostRedirect } from "@/hooks/use-host-redirect";

import { FramerPage } from "./features/framer/framer-page";
import { HomePage } from "./features/home/home-page";
import { NepaliPdfPage } from "./features/nepali-pdf/nepali-pdf-page";
import { PosterPage } from "./features/poster/poster-page";

function AppRoutes() {
  useHostRedirect();

  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<FramerPage />} path="/framer" />
      <Route element={<PosterPage />} path="/poster" />
      <Route element={<NepaliPdfPage />} path="/nepali-pdf" />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <AppHeader />
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
