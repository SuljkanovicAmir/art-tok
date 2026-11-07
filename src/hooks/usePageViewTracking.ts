import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../utils/analytics";

/** Records one page view per route change (query/hash ignored). */
export function usePageViewTracking(): void {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Refs survive StrictMode's simulated remount, so this prevents double counting.
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackPageView(pathname);
  }, [pathname]);
}
