import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import { Icon } from '../../ui/Icon.tsx';
import { ACCEPT_ATTRIBUTE } from '../workspace/files.ts';

interface UploadButtonProps {
  onFiles(files: File[]): void;
  disabled: boolean;
  /** `rail`: icon over a label (desktop rail). `icon`: compact button (mobile top bar). */
  variant: 'rail' | 'icon';
}

/** "Upload" control. A visually hidden file input inside a label, so the label's focus ring shows. */
export function UploadButton({ onFiles, disabled, variant }: UploadButtonProps) {
  const t = useT();
  const id = useId();
  const rail = variant === 'rail';
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center justify-center focus-within:outline-2 focus-within:outline-blue-400 ${
        rail
          ? 'mt-auto w-16 flex-col gap-1 rounded-xl py-2 text-[11px] text-slate-400 hover:bg-slate-800'
          : 'rounded-lg bg-slate-800 px-3 py-1.5'
      } ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`}
    >
      <Icon name="upload" className="size-5" />
      {rail ? t('editor.upload') : <span className="sr-only">{t('editor.upload')}</span>}
      <input
        id={id}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          // Reset so picking the same file again still fires `change`.
          event.target.value = '';
        }}
      />
    </label>
  );
}
