import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { isFbFrameOnlyHost, isPosterOnlyHost } from "@/hostRedirect";

export function useHostRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();

    if (isFbFrameOnlyHost(host)) {
      if (location.pathname !== "/fb-frame") {
        navigate("/fb-frame", { replace: true });
      }
      return;
    }

    if (isPosterOnlyHost(host)) {
      if (location.pathname !== "/poster") {
        navigate("/poster", { replace: true });
      }
      return;
    }
  }, [location.pathname, navigate]);
}
