import { useEffect, useState } from 'react';

/** Narrow or nearly square windows stack into one column. Keep in step with the media queries in the screen stylesheets */
export const COMPACT_SCREEN_QUERY = '(max-width: 1000px), (max-aspect-ratio: 5/4)';

const matches = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_SCREEN_QUERY).matches : false);

export function useCompactScreen() {
  const [compact, setCompact] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COMPACT_SCREEN_QUERY);
    const onChange = () => setCompact(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return compact;
}
