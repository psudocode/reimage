import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CropOverlay from './Overlay.tsx';
import { cropDefaults, type CropOptions } from './options.ts';

const free: CropOptions = {
  ...cropDefaults,
  mode: 'free',
  left: 10,
  top: 10,
  right: 10,
  bottom: 10,
};
const size = { width: 400, height: 200 };

function setup(value: CropOptions, disabled = false) {
  const onChange = vi.fn();
  const view = render(
    <CropOverlay value={value} onChange={onChange} imageSize={size} disabled={disabled} />,
  );
  const surface = view.container.firstElementChild as HTMLElement;
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  return { onChange, surface };
}

describe('CropOverlay', () => {
  it('draws the box where the options say', () => {
    setup(free);
    expect(screen.getByRole('group', { name: 'Crop area' })).toHaveStyle({
      left: '10%',
      top: '10%',
      width: '80%',
      height: '80%',
    });
  });

  it('moves the box by dragging and reports percent edges', () => {
    const { onChange, surface } = setup(free);
    const box = screen.getByRole('group', { name: 'Crop area' });
    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 });
    // 40px of 400 = 10% right, 20px of 200 = 10% down: box hits the right/bottom edge.
    fireEvent.pointerMove(surface, { clientX: 140, clientY: 120 });
    expect(onChange).toHaveBeenLastCalledWith({ ...free, left: 20, right: 0, top: 20, bottom: 0 });
  });

  it('resizes from a handle in free mode', () => {
    const { onChange, surface } = setup(free);
    const handle = screen.getByRole('button', { name: 'Resize crop: top left' });
    fireEvent.pointerDown(handle, { clientX: 40, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 0 });
    expect(onChange).toHaveBeenLastCalledWith({ ...free, left: 0, top: 0 });
  });

  it('ignores pointer moves after the button is released', () => {
    const { onChange, surface } = setup(free);
    fireEvent.pointerDown(screen.getByRole('group'), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(surface);
    fireEvent.pointerMove(surface, { clientX: 50, clientY: 50 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('slides a fixed-ratio box along its spare axis and shows no resize handles', () => {
    const fixed: CropOptions = { ...cropDefaults, ratio: '1:1', positionX: 0 };
    const { onChange, surface } = setup(fixed);
    expect(screen.queryByRole('button', { name: /Resize crop/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('group'), { clientX: 0, clientY: 0, pointerId: 1 });
    // The 400x200 image fits a 200x200 square: 50% spare width. 100px = 25% => half of the spare.
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 80 });
    expect(onChange).toHaveBeenLastCalledWith({ ...fixed, positionX: 50, positionY: 50 });
  });

  it('is inert while a job runs', () => {
    const { onChange, surface } = setup(free, true);
    fireEvent.pointerDown(screen.getByRole('group'), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 50, clientY: 50 });
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resize crop: top left' })).toBeDisabled();
  });
});
