import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt.tsx';

const sw = vi.hoisted(() => ({
  state: { offlineReady: false, needRefresh: false },
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
  update: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [sw.state.offlineReady, sw.setOfflineReady],
    needRefresh: [sw.state.needRefresh, sw.setNeedRefresh],
    updateServiceWorker: sw.update,
  }),
}));

describe('UpdatePrompt', () => {
  beforeEach(() => {
    sw.state = { offlineReady: false, needRefresh: false };
    vi.clearAllMocks();
  });

  it('renders nothing by default', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces offline readiness and can be dismissed', () => {
    sw.state.offlineReady = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready to work offline.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(sw.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('only reloads when the user accepts the update', () => {
    sw.state.needRefresh = true;
    render(<UpdatePrompt />);
    expect(sw.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(sw.update).toHaveBeenCalledWith(true);
  });
});
