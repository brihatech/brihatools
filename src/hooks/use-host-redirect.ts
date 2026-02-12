import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const POSTER_ONLY_HOSTS = new Set([
  "tools.chunnapoudel.com",
  "tools.binodformp.com",
  "tools.binodchaudhary.com",
]);

export function useHostRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (!POSTER_ONLY_HOSTS.has(host)) return;

    if (location.pathname !== "/poster") {
      navigate("/poster", { replace: true });
    }
  }, [location.pathname, navigate]);
}
