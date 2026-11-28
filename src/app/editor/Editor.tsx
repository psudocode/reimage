import { Suspense, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { useT } from '../../i18n/index.ts';
import { Icon } from '../../ui/Icon.tsx';
import { ImageList } from '../workspace/ImageList.tsx';
import { formatBytes, savedPercent } from '../workspace/files.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import { ActionButton } from './ActionButton.tsx';
import { Canvas } from './Canvas.tsx';
import { Filmstrip } from './Filmstrip.tsx';
import { ItemNotes } from './ItemNotes.tsx';
import { neighbourIndex, swipeDirection } from './previewMath.ts';
import { Stats } from './Stats.tsx';
import { CategoryNav, SearchBox, ToolButtons } from './ToolBrowser.tsx';
import { UploadButton } from './UploadButton.tsx';
import { useEditorModel, type EditorModel, type Workspace } from './useEditorModel.ts';
import { useIsMobile } from './useIsMobile.ts';

const OPTIONS_ID = 'tool-options';

interface EditorProps {
  workspace: Workspace;
  onFiles(files: File[]): void;
  skipped: number;
}

interface LayoutProps extends EditorProps {
  selected: WorkspaceItem;
  model: EditorModel;
}

/** The editor: pick a tool on the left, see the live result in the middle, apply from the top. */
export function Editor({ workspace, onFiles, skipped }: EditorProps) {
  const model = useEditorModel(workspace);
  const mobile = useIsMobile();
  const { selected } = workspace;
  if (!selected) return null;
  const props = { workspace, onFiles, skipped, selected, model };
  return mobile ? <EditorMobile {...props} /> : <EditorDesktop {...props} />;
}

function SkippedNote({ count }: { count: number }) {
  const t = useT();
  if (count === 0) return null;
  return (
    <p role="status" className="text-sm text-amber-400">
      {t('workspace.skipped').replace('{count}', String(count))}
    </p>
  );
}

function PreviewProblem({ message }: { message?: string }) {
  const t = useT();
  if (!message) return null;
  return (
    <p role="status" className="text-xs text-amber-400">
      {t('editor.previewError').replace('{message}', message)}
    </p>
  );
}

function BatchSummary({ items }: { items: WorkspaceItem[] }) {
  const t = useT();
  const done = items.filter((item) => item.status === 'done' && item.result);
  if (done.length === 0) return null;
  const before = done.reduce((sum, item) => sum + item.size, 0);
  const after = done.reduce((sum, item) => sum + (item.result?.bytesAfter ?? 0), 0);
  return (
    <p aria-live="polite" className="text-xs text-slate-400">
      {t('workspace.summary')
        .replace('{count}', String(done.length))
        .replace('{before}', formatBytes(before))
        .replace('{after}', formatBytes(after))
        .replace('{percent}', String(-savedPercent(before, after)))}
    </p>
  );
}

function RunProgress({ items }: { items: WorkspaceItem[] }) {
  const t = useT();
  const average = items.reduce((sum, item) => sum + item.progress, 0) / Math.max(items.length, 1);
  return (
    <progress value={average} max={1} aria-label={t('editor.saving')} className="h-1.5 w-24" />
  );
}

/** The active tool's name and its options panel; the same on desktop and mobile. */
function ToolSection({
  workspace,
  model,
  panelClassName,
}: {
  workspace: Workspace;
  model: EditorModel;
  panelClassName?: string;
}) {
  const t = useT();
  const { Panel } = model.tool;
  return (
    <>
      <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
        <Icon name={model.tool.icon} className="size-4" />
        {t(model.tool.labelKey)}
      </h2>
      <div className={panelClassName}>
        <Suspense fallback={<p className="text-sm text-slate-400">{t('workspace.loading')}</p>}>
          <Panel key={workspace.toolId} value={workspace.options} onChange={workspace.setOptions} />
        </Suspense>
      </div>
    </>
  );
}

function EditorDesktop({ workspace, onFiles, skipped, selected, model }: LayoutProps) {
  const t = useT();
  const { items, running } = workspace;
  const [dropping, setDropping] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(true);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    if (!running) onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[34rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <CategoryNav
        variant="rail"
        groups={model.groups}
        activeId={model.activeCategory}
        onSelect={model.browseCategory}
      >
        <UploadButton variant="rail" onFiles={onFiles} disabled={running} />
      </CategoryNav>

      <aside
        aria-label={t('editor.toolsLabel')}
        className="flex w-56 shrink-0 flex-col gap-3 border-r border-slate-800 bg-slate-900/70 p-3"
      >
        <SearchBox value={model.query} onChange={model.setQuery} />
        <div className="overflow-y-auto">
          <ToolButtons
            variant="grid"
            tools={model.visibleTools}
            activeId={workspace.toolId}
            disabled={running}
            onSelect={workspace.setToolId}
            query={model.query}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 py-2">
          <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
            <Icon name={model.tool.icon} className="size-4 shrink-0" />
            <span className="truncate">{t(model.tool.labelKey)}</span>
          </h2>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Stats item={selected} preview={model.preview} />
            <BatchSummary items={items} />
            {running && <RunProgress items={items} />}
            <ActionButton workspace={workspace} />
            <button
              type="button"
              aria-expanded={optionsOpen}
              aria-controls={OPTIONS_ID}
              aria-label={t(optionsOpen ? 'editor.hideOptions' : 'editor.showOptions')}
              title={t(optionsOpen ? 'editor.hideOptions' : 'editor.showOptions')}
              onClick={() => setOptionsOpen(!optionsOpen)}
              className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
            >
              <Icon name={optionsOpen ? 'chevron-right' : 'chevron-left'} className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div
            aria-label={t('editor.canvas')}
            role="region"
            onDragOver={(event) => {
              event.preventDefault();
              if (!running) setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
            className={`min-w-0 flex-1 space-y-2 overflow-auto bg-slate-900/40 p-6 ${
              dropping ? 'outline-2 -outline-offset-8 outline-dashed outline-violet-500' : ''
            }`}
          >
            <div className="mx-auto max-w-3xl rounded-lg shadow-2xl shadow-black/60">
              <Canvas
                key={selected.id}
                item={selected}
                tool={model.tool}
                options={workspace.options}
                onOptionsChange={workspace.setOptions}
                preview={model.preview}
                locked={running}
              />
            </div>
            <div className="mx-auto max-w-3xl space-y-1">
              <ItemNotes item={selected} />
              <PreviewProblem message={model.preview.error} />
              <SkippedNote count={skipped} />
            </div>
          </div>

          {optionsOpen && (
            <section
              id={OPTIONS_ID}
              aria-label={t('editor.options')}
              className="w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900 p-4"
            >
              <Suspense
                fallback={<p className="text-sm text-slate-400">{t('workspace.loading')}</p>}
              >
                <model.tool.Panel
                  key={workspace.toolId}
                  value={workspace.options}
                  onChange={workspace.setOptions}
                />
              </Suspense>
            </section>
          )}
        </div>

        <Filmstrip
          items={items}
          selectedId={selected.id}
          locked={running}
          onSelect={workspace.select}
          onRemove={workspace.removeItem}
          onClear={workspace.clear}
        />
      </div>
    </div>
  );
}

function EditorMobile({ workspace, onFiles, skipped, selected, model }: LayoutProps) {
  const t = useT();
  const { items, running } = workspace;
  const [searching, setSearching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const index = items.findIndex((item) => item.id === selected.id);
  const position = t('editor.position')
    .replace('{current}', String(index + 1))
    .replace('{total}', String(items.length));

  const go = (step: 1 | -1) => {
    const next = items[neighbourIndex(index, items.length, step)];
    if (next) workspace.select(next.id);
  };

  const endSwipe = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || running) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    if (direction) go(direction === 'next' ? 1 : -1);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="min-w-0 flex-1 truncate text-xs">
          <Stats item={selected} preview={model.preview} />
        </div>
        <button
          type="button"
          aria-pressed={searching}
          aria-label={t('editor.searchLabel')}
          onClick={() => {
            setSearching(!searching);
            if (searching) model.setQuery('');
          }}
          className="rounded-lg bg-slate-800 px-3 py-1.5"
        >
          <Icon name="search" className="size-5" />
        </button>
        <UploadButton variant="icon" onFiles={onFiles} disabled={running} />
        <ActionButton workspace={workspace} compact />
      </div>

      <div
        role="region"
        aria-label={t('editor.canvas')}
        // Swipe changes image. Only on the compare view: on the crop canvas a horizontal drag moves the box.
        onPointerDown={(event) => {
          if (!model.tool.Overlay) swipeStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={endSwipe}
        onPointerCancel={() => (swipeStart.current = null)}
        className="flex-1 space-y-2 overflow-auto bg-slate-900/40 p-3"
      >
        <div className="mx-auto max-w-md rounded-lg shadow-2xl shadow-black/60">
          <Canvas
            key={selected.id}
            item={selected}
            tool={model.tool}
            options={workspace.options}
            onOptionsChange={workspace.setOptions}
            preview={model.preview}
            locked={running}
          />
        </div>
        <div className="mx-auto max-w-md space-y-1">
          <ItemNotes item={selected} />
          <PreviewProblem message={model.preview.error} />
          <SkippedNote count={skipped} />
          <BatchSummary items={items} />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index <= 0}
              aria-label={t('editor.previous')}
              className="rounded p-1 disabled:opacity-30"
            >
              <Icon name="chevron-left" className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`${t('editor.allImages')}: ${position}`}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-slate-800"
          >
            <Icon name="images" className="size-4" />
            <span aria-hidden="true">{position}</span>
          </button>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index >= items.length - 1}
              aria-label={t('editor.next')}
              className="rounded p-1 disabled:opacity-30"
            >
              <Icon name="chevron-right" className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto border-t border-slate-800 bg-slate-900 px-4 py-3">
        <ToolSection workspace={workspace} model={model} />
      </div>

      {searching && (
        <div className="px-3 pb-2">
          <SearchBox value={model.query} onChange={model.setQuery} autoFocus />
        </div>
      )}
      <div className="border-t border-slate-800 bg-slate-900/80">
        <ToolButtons
          variant="chips"
          tools={model.visibleTools}
          activeId={workspace.toolId}
          disabled={running}
          onSelect={workspace.setToolId}
          query={model.query}
        />
      </div>
      <CategoryNav
        variant="tabs"
        groups={model.groups}
        activeId={model.activeCategory}
        onSelect={(id) => {
          model.browseCategory(id);
          setSearching(false);
        }}
      />

      {sheetOpen && (
        <ImagesSheet
          workspace={workspace}
          onClose={() => setSheetOpen(false)}
          onPick={(id) => {
            workspace.select(id);
            setSheetOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Mobile: the full list of images (select, download, remove) in a bottom sheet. */
function ImagesSheet({
  workspace,
  onClose,
  onPick,
}: {
  workspace: Workspace;
  onClose(): void;
  onPick(id: string): void;
}) {
  const t = useT();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('editor.allImages')}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className="absolute inset-0 z-10 flex flex-col justify-end bg-black/60"
    >
      <div className="max-h-[75%] space-y-3 overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('editor.allImages')}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                workspace.clear();
                onClose();
              }}
              disabled={workspace.running}
              className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
            >
              {t('workspace.clearAll')}
            </button>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label={t('editor.close')}
              className="rounded p-1 hover:bg-slate-800"
            >
              <Icon name="close" className="size-5" />
            </button>
          </div>
        </div>
        <ImageList
          items={workspace.items}
          locked={workspace.running}
          onRemove={workspace.removeItem}
          selectedId={workspace.selected?.id}
          onSelect={onPick}
        />
      </div>
    </div>
  );
}
