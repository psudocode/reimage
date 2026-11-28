/** Every icon the app can draw. Tools pick one by name in their `ToolUI`. */
export const ICON_NAMES = [
  'crop',
  'resize',
  'compress',
  'convert',
  'transform',
  'export',
  'shield',
  'pipeline',
  'upload',
  'download',
  'search',
  'close',
  'images',
  'chevron-left',
  'chevron-right',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
