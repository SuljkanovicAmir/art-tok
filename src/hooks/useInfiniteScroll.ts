import { useRef } from "react";

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

  const setObserverTarget = (node: Element | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node || isLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          onIntersect();
        }
      },
      { rootMargin },
    );

    observerRef.current.observe(node);

    // React 19 ref cleanup — returned function runs when ref detaches
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  };

  return setObserverTarget;
}
