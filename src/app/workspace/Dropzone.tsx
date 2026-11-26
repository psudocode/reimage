import { useId, useRef, useState, type DragEvent } from 'react';
import { useT } from '../../i18n/index.ts';
import { ACCEPT_ATTRIBUTE } from './files.ts';

interface DropzoneProps {
  onFiles(files: File[]): void;
  disabled?: boolean;
  compact?: boolean;
}

export function Dropzone({ onFiles, disabled = false, compact = false }: DropzoneProps) {
  const t = useT();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition focus-within:ring-2 focus-within:ring-blue-500 ${
        compact ? 'px-6 py-5' : 'px-6 py-16'
      } ${
        disabled
          ? 'cursor-not-allowed border-slate-800 opacity-50'
          : dragging
            ? 'cursor-pointer border-blue-500 bg-blue-500/10'
            : 'cursor-pointer border-slate-700 hover:border-slate-500'
      }`}
    >
      <input
        ref={inputRef}
        id={inputId}
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
      <span className={compact ? 'text-sm font-medium' : 'text-lg font-semibold'}>
        {t('workspace.dropTitle')}
      </span>
      <span className="mt-1 text-sm text-slate-400">{t('workspace.dropHint')}</span>
    </label>
  );
}
