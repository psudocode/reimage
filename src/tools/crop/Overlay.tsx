import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolOverlayProps } from '../types.ts';
import {
  boxFromOptions,
  CROP_HANDLES,
  moveCropBox,
  resizeCropBox,
  type CropHandle,
} from './box.ts';
import type { CropOptions } from './options.ts';

interface Drag {
  /** `move` or the handle being dragged. */
  target: 'move' | CropHandle;
  startX: number;
  startY: number;
  start: CropOptions;
}

const HANDLE_POSITION: Record<CropHandle, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Keyboard nudge: 1% per press, 10% with Shift. */
function nudge(event: KeyboardEvent): [number, number] | undefined {
  const arrow = ARROWS[event.key];
  if (!arrow) return undefined;
  const step = event.shiftKey ? 10 : 1;
  return [arrow[0] * step, arrow[1] * step];
}

/**
 * Interactive crop box drawn over the image. Drag the box to move it, drag a
 * handle to resize (free mode). Everything is written back as percent options.
 * Keyboard: focus the box or a handle, then use the arrow keys (Shift = bigger steps).
 */
export default function CropOverlay({
  value,
  onChange,
  imageSize,
  disabled = false,
}: ToolOverlayProps<CropOptions>) {
  const t = useT();
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const aspect = imageSize.width / imageSize.height;
  const box = boxFromOptions(value, aspect);
  const resizable = value.mode === 'free';

  const begin = (target: Drag['target']) => (event: PointerEvent<HTMLElement>) => {
    if (disabled) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { target, startX: event.clientX, startY: event.clientY, start: value };
  };

  const track = (event: PointerEvent) => {
    const active = drag.current;
    const rect = surface.current?.getBoundingClientRect();
    if (!active || !rect || rect.width === 0 || rect.height === 0) return;
    const dx = ((event.clientX - active.startX) / rect.width) * 100;
    const dy = ((event.clientY - active.startY) / rect.height) * 100;
    onChange(
      active.target === 'move'
        ? moveCropBox(active.start, aspect, dx, dy)
        : resizeCropBox(active.start, aspect, active.target, dx, dy),
    );
  };

  const end = () => {
    drag.current = null;
  };

  const onBoxKey = (event: KeyboardEvent) => {
    const step = nudge(event);
    if (!step || disabled) return;
    event.preventDefault();
    onChange(moveCropBox(value, aspect, step[0], step[1]));
  };

  const onHandleKey = (handle: CropHandle) => (event: KeyboardEvent) => {
    const step = nudge(event);
    if (!step || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(resizeCropBox(value, aspect, handle, step[0], step[1]));
  };

  return (
    <div
      ref={surface}
      className="absolute inset-0 touch-none select-none"
      onPointerMove={track}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('editor.cropBox')}
        aria-description={t('editor.cropBoxHint')}
        onPointerDown={begin('move')}
        onKeyDown={onBoxKey}
        className={`absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-400 ${
          disabled ? '' : 'cursor-move'
        }`}
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
        >
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="border border-white/25" />
          ))}
        </div>
        {resizable &&
          CROP_HANDLES.map((handle) => {
            const { left, top, cursor } = HANDLE_POSITION[handle];
            return (
              <button
                key={handle}
                type="button"
                disabled={disabled}
                aria-label={`${t('editor.cropHandle')}: ${t(`editor.handles.${handle}`)}`}
                onPointerDown={begin(handle)}
                onKeyDown={onHandleKey(handle)}
                className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-slate-900/40 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 md:size-3"
                style={{ left, top, cursor }}
              />
            );
          })}
      </div>
    </div>
  );
}
