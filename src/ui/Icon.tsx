import type { ReactNode } from 'react';
import type { IconName } from './iconNames.ts';

// 24x24 grid, 1.75 stroke, drawn with currentColor so the text colour themes them.
const PATHS: Record<IconName, ReactNode> = {
  crop: (
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </>
  ),
  resize: (
    <>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </>
  ),
  compress: (
    <>
      <path d="m4 14 6 0 0 6" />
      <path d="m20 10-6 0 0-6" />
      <path d="m14 10 7-7" />
      <path d="m3 21 7-7" />
    </>
  ),
  convert: (
    <>
      <path d="M3 7h14l-3-3" />
      <path d="M21 17H7l3 3" />
    </>
  ),
  transform: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="1.5" />
      <path d="M20 8v10a2 2 0 0 1-2 2H8" />
    </>
  ),
  'remove-background': (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" strokeDasharray="3 3" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M21 8v10a2 2 0 0 1-2 2" />
      <path d="m3 15 4-4 5 5" />
    </>
  ),
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
};

interface IconProps {
  name: IconName;
  className?: string;
}

/** Decorative SVG icon. Always pair it with a visible or `aria-label`led text. */
export function Icon({ name, className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
