import { useCallback, useEffect, useRef } from "react";

interface InfiniteScrollOptions {
  isLoading: boolean;
  hasMore: boolean;
  onIntersect: () => void;
  rootMargin?: string;
}

export function useInfiniteScroll({
  isLoading,
  hasMore,
  onIntersect,
  rootMargin = "200px",
}: InfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const setObserverTarget = useCallback(
    (node: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node || isLoading) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry?.isIntersecting && hasMore) {
            onIntersect();
          }
        },
        { rootMargin }
      );

      observerRef.current.observe(node);
    },
    [hasMore, isLoading, onIntersect, rootMargin]
  );

  return setObserverTarget;
}
