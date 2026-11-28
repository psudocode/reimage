import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

/** True below the `md` breakpoint (768px). Falls back to desktop where `matchMedia` is missing. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(MOBILE_QUERY).matches : false,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
