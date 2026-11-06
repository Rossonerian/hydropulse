import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

// Below this width the operations screen uses the map + bottom sheet layout.
export const COMPACT_QUERY = '(max-width: 1023px)';
export const useCompactLayout = () => useMediaQuery(COMPACT_QUERY);
