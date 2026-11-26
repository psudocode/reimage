import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceState,
  workspaceReducer,
  type ItemResult,
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
});
