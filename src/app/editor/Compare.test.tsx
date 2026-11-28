import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Compare } from './Compare.tsx';

describe('Compare', () => {
  it('shows only the original until a preview exists', () => {
    const { container } = render(<Compare before="blob:before" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('exposes a keyboard-operable slider that starts in the middle', () => {
    render(<Compare before="blob:before" after="blob:after" />);
    const slider = screen.getByRole('slider', { name: 'Before and after' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '52');
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(slider).toHaveAttribute('aria-valuenow', '42');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('moves the divider with the pointer', () => {
    const { container } = render(<Compare before="blob:before" after="blob:after" />);
    const surface = container.firstElementChild as HTMLElement;
    surface.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    fireEvent.pointerDown(surface, { clientX: 50, pointerId: 1 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25');
    fireEvent.pointerMove(surface, { clientX: 150 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '75');
    fireEvent.pointerUp(surface);
    fireEvent.pointerMove(surface, { clientX: 0 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '75');
  });

  it('keeps its pointer events to itself so a parent swipe handler never sees a slider drag', () => {
    const parent = { down: vi.fn(), up: vi.fn() };
    const { container } = render(
      <div onPointerDown={parent.down} onPointerUp={parent.up}>
        <Compare before="blob:before" after="blob:after" />
      </div>,
    );
    const surface = container.querySelector('.touch-none') as HTMLElement;
    surface.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    fireEvent.pointerDown(surface, { clientX: 20, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 180 });
    expect(parent.down).not.toHaveBeenCalled();
    expect(parent.up).not.toHaveBeenCalled();
  });

  it('keeps the original undistorted when the output shape differs', () => {
    const { container } = render(<Compare before="blob:before" after="blob:after" />);
    const [, before] = container.querySelectorAll('img');
    expect(before).toHaveClass('object-contain');
    expect(before).not.toHaveClass('object-fill');
  });
});
