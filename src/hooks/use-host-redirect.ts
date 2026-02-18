import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { isPosterOnlyHost } from "@/hostRedirect";

export function useHostRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (!isPosterOnlyHost(host)) return;

    if (location.pathname !== "/poster") {
      navigate("/poster", { replace: true });
    }
  }, [location.pathname, navigate]);
}
