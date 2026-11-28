import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '../../i18n/index.ts';
import { sliderPercent } from './previewMath.ts';

interface CompareProps {
  before: string;
  /** Missing while the first preview is still being made. */
  after?: string;
  /** A newer preview is on its way: dim the picture a little. */
  busy?: boolean;
}

/** Before/after slider: drag anywhere, or focus the handle and use the arrow keys. */
export function Compare({ before, after, busy = false }: CompareProps) {
  const t = useT();
  const surface = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [position, setPosition] = useState(50);

  const moveTo = (event: PointerEvent) => {
    const rect = surface.current?.getBoundingClientRect();
    if (rect) setPosition(sliderPercent(event.clientX, rect));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    const next: Record<string, number> = {
      ArrowLeft: position - step,
      ArrowRight: position + step,
      Home: 0,
      End: 100,
    };
    const value = next[event.key];
    if (value === undefined) return;
    event.preventDefault();
    setPosition(Math.min(100, Math.max(0, value)));
  };

  return (
    <div
      ref={surface}
      className={`relative cursor-ew-resize touch-none select-none overflow-hidden rounded-lg transition-opacity ${
        busy ? 'opacity-70' : ''
      }`}
      onPointerDown={(event) => {
        // The slider owns horizontal drags here; don't let a parent's swipe-to-change-image see them.
        event.stopPropagation();
        dragging.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={(event) => dragging.current && moveTo(event)}
      onPointerUp={(event) => {
        event.stopPropagation();
        dragging.current = false;
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        dragging.current = false;
      }}
    >
      {/* "After" sets the size; "before" is laid over it and clipped from the right. */}
      <img src={after ?? before} alt="" draggable={false} className="block h-auto w-full" />
      {after && (
        <img
          src={before}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
      )}
      {after && (
        <>
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">
            {t('editor.before')}
          </span>
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">
            {t('editor.after')}
          </span>
          <div
            className="absolute inset-y-0 w-0.5 bg-white shadow"
            style={{ left: `${position}%` }}
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label={t('editor.compareLabel')}
              aria-description={t('editor.compareHint')}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(position)}
              onKeyDown={onKeyDown}
              className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 shadow outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <span aria-hidden="true">⇆</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
