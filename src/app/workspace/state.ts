export type ItemStatus = 'ready' | 'processing' | 'done' | 'failed';

export interface ItemResult {
  /** Object URL of the encoded blob; revoked when the item is removed or re-run. */
  url: string;
  /** Kept so a ZIP can be built without re-reading the object URL. */
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  bytesAfter: number;
  downscaled: boolean;
  targetMissed: boolean;
}

export interface WorkspaceItem {
  id: string;
  file: File;
  name: string;
  size: number;
  /** Object URL of the original, for the thumbnail. */
  previewUrl: string;
  status: ItemStatus;
  /** 0..1 */
  progress: number;
  result?: ItemResult;
  error?: string;
}

export interface WorkspaceState {
  items: WorkspaceItem[];
  running: boolean;
}

export const initialWorkspaceState: WorkspaceState = { items: [], running: false };

export type WorkspaceAction =
  | { type: 'add'; items: WorkspaceItem[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'begin' }
  | { type: 'progress'; id: string; fraction: number }
  | { type: 'result'; id: string; result: ItemResult }
  | { type: 'failure'; id: string; message: string }
  | { type: 'invalidate' }
  | { type: 'end' };

function update(
  state: WorkspaceState,
  id: string,
  patch: (item: WorkspaceItem) => WorkspaceItem,
): WorkspaceState {
  return { ...state, items: state.items.map((item) => (item.id === id ? patch(item) : item)) };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'add':
      return { ...state, items: [...state.items, ...action.items] };
    case 'remove':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case 'clear':
      return { ...state, items: [] };
    case 'begin':
      return {
        running: true,
        items: state.items.map((item) => ({
          ...item,
          status: 'processing',
          progress: 0,
          result: undefined,
          error: undefined,
        })),
      };
    case 'progress':
      return update(state, action.id, (item) =>
        item.status === 'processing' ? { ...item, progress: action.fraction } : item,
      );
    case 'result':
      return update(state, action.id, (item) => ({
        ...item,
        status: 'done',
        progress: 1,
        result: action.result,
        error: undefined,
      }));
    case 'failure':
      return update(state, action.id, (item) => ({
        ...item,
        status: 'failed',
        error: action.message,
      }));
    case 'invalidate':
      // Options changed: finished or failed items no longer match what is on screen.
      return {
        ...state,
        items: state.items.map((item) =>
          item.status === 'done' || item.status === 'failed'
            ? { ...item, status: 'ready', progress: 0, result: undefined, error: undefined }
            : item,
        ),
      };
    case 'end':
      // Anything still processing was cancelled: put it back so it can be re-run.
      return {
        running: false,
        items: state.items.map((item) =>
          item.status === 'processing' ? { ...item, status: 'ready', progress: 0 } : item,
        ),
      };
  }
}
