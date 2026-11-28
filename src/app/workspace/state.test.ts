import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceState,
  workspaceReducer,
  type ItemResult,
  type WorkspaceAction,
  type WorkspaceItem,
  type WorkspaceState,
} from './state.ts';

const item = (id: string, patch: Partial<WorkspaceItem> = {}): WorkspaceItem => ({
  id,
  file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
  name: `${id}.jpg`,
  size: 1000,
  previewUrl: `blob:${id}`,
  status: 'ready',
  progress: 0,
  ...patch,
});

const result: ItemResult = {
  url: 'blob:out',
  fileName: 'a-reimage.jpg',
  width: 10,
  height: 10,
  bytesAfter: 400,
  downscaled: false,
  targetMissed: false,
};

const withItems = (...items: WorkspaceItem[]): WorkspaceState => ({ items, running: false });

describe('workspaceReducer', () => {
  it('adds, removes and clears items', () => {
    let state = workspaceReducer(initialWorkspaceState, {
      type: 'add',
      items: [item('a'), item('b')],
    });
    expect(state.items.map((i) => i.id)).toEqual(['a', 'b']);
    state = workspaceReducer(state, { type: 'remove', id: 'a' });
    expect(state.items.map((i) => i.id)).toEqual(['b']);
    state = workspaceReducer(state, { type: 'clear' });
    expect(state.items).toEqual([]);
  });

  it('begin resets every item for a fresh run, dropping old results and errors', () => {
    const state = workspaceReducer(
      withItems(
        item('a', { status: 'done', progress: 1, result }),
        item('b', { status: 'failed', error: 'boom' }),
      ),
      { type: 'begin' },
    );
    expect(state.running).toBe(true);
    for (const i of state.items) {
      expect(i.status).toBe('processing');
      expect(i.progress).toBe(0);
      expect(i.result).toBeUndefined();
      expect(i.error).toBeUndefined();
    }
  });

  it('records progress, results and failures per image', () => {
    let state = workspaceReducer(withItems(item('a'), item('b')), { type: 'begin' });
    state = workspaceReducer(state, { type: 'progress', id: 'a', fraction: 0.5 });
    expect(state.items[0]!.progress).toBe(0.5);
    state = workspaceReducer(state, { type: 'result', id: 'a', result });
    expect(state.items[0]).toMatchObject({ status: 'done', progress: 1, result });
    state = workspaceReducer(state, { type: 'failure', id: 'b', message: 'bad file' });
    expect(state.items[1]).toMatchObject({ status: 'failed', error: 'bad file' });
  });

  it('ignores progress for an image that already finished', () => {
    let state = workspaceReducer(withItems(item('a')), { type: 'begin' });
    state = workspaceReducer(state, { type: 'result', id: 'a', result });
    state = workspaceReducer(state, { type: 'progress', id: 'a', fraction: 0.2 });
    expect(state.items[0]!.progress).toBe(1);
  });

  it('end stops the run and returns unfinished images to ready', () => {
    let state = workspaceReducer(withItems(item('a'), item('b')), { type: 'begin' });
    state = workspaceReducer(state, { type: 'result', id: 'a', result });
    state = workspaceReducer(state, { type: 'end' });
    expect(state.running).toBe(false);
    expect(state.items[0]!.status).toBe('done');
    expect(state.items[1]).toMatchObject({ status: 'ready', progress: 0 });
  });

  it('invalidate returns finished and failed items to ready and drops their results', () => {
    const state = workspaceReducer(
      withItems(
        item('a', { status: 'done', progress: 1, result }),
        item('b', { status: 'failed', error: 'boom' }),
        item('c'),
      ),
      { type: 'invalidate' },
    );
    expect(state.items.map((i) => i.status)).toEqual(['ready', 'ready', 'ready']);
    expect(state.items[0]).toMatchObject({ progress: 0, result: undefined });
    expect(state.items[1]!.error).toBeUndefined();
  });

  describe('combined result', () => {
    const withCombined: WorkspaceState = {
      running: false,
      items: [item('a'), item('b')],
      combined: result,
    };

    it('keeps the result when the run ends', () => {
      const running = workspaceReducer(withCombined, { type: 'begin' });
      expect(running.combined).toBeUndefined();
      const done = workspaceReducer(workspaceReducer(running, { type: 'combined', result }), {
        type: 'end',
      });
      expect(done.combined).toBe(result);
      expect(done.running).toBe(false);
      expect(done.items.every((entry) => entry.status === 'ready')).toBe(true);
    });

    it('records a failure and clears it on the next run', () => {
      const failed = workspaceReducer(
        { ...withCombined, combined: undefined },
        { type: 'combinedFailure', message: 'boom' },
      );
      expect(failed.combinedError).toBe('boom');
      expect(workspaceReducer(failed, { type: 'begin' }).combinedError).toBeUndefined();
    });

    it('is dropped when the list or the options change', () => {
      const actions: WorkspaceAction[] = [
        { type: 'add', items: [item('c')] },
        { type: 'remove', id: 'a' },
        { type: 'clear' },
        { type: 'invalidate' },
      ];
      for (const action of actions) {
        expect(workspaceReducer(withCombined, action).combined).toBeUndefined();
      }
    });
  });
});
