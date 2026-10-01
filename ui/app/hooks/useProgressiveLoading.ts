import { useEffect, useRef } from 'react';

/**
 * Differentiates between the first-ever fetch and subsequent re-fetches.
 *
 * Returns:
 * - `firstLoading`  — true during the initial load (no data yet). Show Skeleton.
 * - `reloading`     — true when re-fetching with existing content visible.
 *                     Show ProgressCircle next to the title; keep content on screen.
 *
 * Pass `resetKey` (e.g. the active namespace) to reset the "has loaded once"
 * tracking when the data source changes entirely — e.g. switching namespaces
 * in a keepMounted tab forces a Skeleton instead of a stale-looking ProgressCircle.
 *
 * Usage:
 *   const { data, isLoading } = useDql(query);
 *   const { firstLoading, reloading } = useProgressiveLoading(isLoading, data, namespace);
 *   <SectionCard isLoading={firstLoading} reloading={reloading} ...>
 */
export function useProgressiveLoading(isLoading: boolean, data: unknown, resetKey?: unknown) {
  const hasLoadedOnce = useRef(false);
  const prevResetKey  = useRef(resetKey);

  // Synchronous reset so the very first render after a key change already sees firstLoading=true.
  if (resetKey !== undefined && prevResetKey.current !== resetKey) {
    prevResetKey.current  = resetKey;
    hasLoadedOnce.current = false;
  }

  useEffect(() => {
    if (!isLoading && data !== undefined) {
      hasLoadedOnce.current = true;
    }
  }, [isLoading, data]);

  return {
    firstLoading: isLoading && !hasLoadedOnce.current,
    reloading:    isLoading && hasLoadedOnce.current,
  };
}
