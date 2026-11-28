import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobEvents, JobHandle, JobOutcome } from '../../core/job/JobRunner.ts';
import type { PreviewRequest } from '../../core/job/JobRunner.ts';
import type { ImageResult, Job } from '../../core/pipeline/types.ts';
import { LocaleContext, type Locale } from '../../i18n/index.ts';
import { Workspace } from './Workspace.tsx';
import type { WorkspaceDeps, WorkspaceRunner } from './useWorkspace.ts';

interface Harness {
  deps: WorkspaceDeps;
  jobs: Job[];
  events: JobEvents[];
  cancel: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  createRunner: ReturnType<typeof vi.fn>;
  revoked: string[];
  previews: Array<{
    request: PreviewRequest;
    resolve(result: ImageResult): void;
    reject(error: Error): void;
  }>;
  finish(status: JobOutcome['status']): void;
}

function makeHarness(): Harness {
  let counter = 0;
  let urls = 0;
  const jobs: Job[] = [];
  const events: JobEvents[] = [];
  const revoked: string[] = [];
  const previews: Harness['previews'] = [];
  const cancel = vi.fn();
  const dispose = vi.fn();
  let settle: (outcome: JobOutcome) => void = () => {};

  const runner: WorkspaceRunner = {
    start(job, jobEvents) {
      jobs.push(job);
      events.push(jobEvents);
      const promise = new Promise<JobOutcome>((resolve) => {
        settle = resolve;
      });
      const handle: JobHandle = { id: job.id, status: 'running', promise, cancel };
      return handle;
    },
    preview(request) {
      return new Promise<ImageResult>((resolve, reject) => {
        previews.push({ request, resolve, reject });
      });
    },
    dispose,
  };
  const createRunner = vi.fn(() => runner);

  const harness: Harness = {
    jobs,
    events,
    cancel,
    dispose,
    createRunner,
    revoked,
    previews,
    finish: (status) => settle({ jobId: jobs.at(-1)!.id, status, results: [], failures: [] }),
    deps: {
      createRunner,
      createId: () => `id-${(counter += 1)}`,
      createObjectURL: () => `blob:url-${(urls += 1)}`,
      revokeObjectURL: (url) => revoked.push(url),
    },
  };
  return harness;
}

const image = (name: string, type = 'image/jpeg', size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

const imageResult = (
  imageId: string,
  bytesAfter: number,
  extra: Partial<ImageResult> = {},
): ImageResult => ({
  imageId,
  blob: new Blob([new Uint8Array(bytesAfter)], { type: 'image/jpeg' }),
  width: 100,
  height: 80,
  bytesBefore: 1000,
  bytesAfter,
  ms: 5,
  ...extra,
});

function setup(locale: Locale = 'en') {
  const harness = makeHarness();
  const view = render(
    <LocaleContext.Provider value={locale}>
      <Workspace deps={harness.deps} />
    </LocaleContext.Provider>,
  );
  const input = () => view.container.querySelector('input[type="file"]') as HTMLInputElement;
  const add = (...files: File[]) => fireEvent.change(input(), { target: { files } });
  return { harness, view, add, input };
}

const apply = () => screen.getByRole('button', { name: 'Apply' });
const tool = (name: string) => screen.getByRole('button', { name });

describe('Workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts as a drop zone and starts no workers', () => {
    const { harness } = setup();
    expect(screen.getByText(/No images yet/)).toBeInTheDocument();
    expect(screen.getByText(/Drop images here/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(harness.createRunner).not.toHaveBeenCalled();
  });

  it('turns into the editor once images are added, and reports skipped files', async () => {
    const { add } = setup();
    add(
      image('a.jpg'),
      image('b.png', 'image/png'),
      image('c.gif', 'image/gif'),
      image('d.pdf', 'application/pdf'),
    );
    await screen.findByRole('radio', { name: /Fixed quality/ });
    expect(screen.getByRole('button', { name: 'a.jpg' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'b.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'c.gif' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Skipped 2:/)).toBeInTheDocument();
    expect(apply()).toBeEnabled();
  });

  it('builds the category rail and tool grid from the registry', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    const rail = screen.getByRole('navigation', { name: 'Tool categories' });
    expect(
      within(rail)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Transform', 'Export', 'Automate']);
    // The active tool (Compress) is filed under Export.
    expect(within(rail).getByRole('button', { name: 'Export' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(tool('Compress')).toHaveAttribute('aria-pressed', 'true');
    expect(tool('Convert')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Crop' })).not.toBeInTheDocument();

    fireEvent.click(within(rail).getByRole('button', { name: 'Transform' }));
    expect(tool('Resize')).toBeInTheDocument();
    expect(tool('Crop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument();
  });

  it('finds tools in every category by search', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tools' }), {
      target: { value: 'cr' },
    });
    expect(tool('Crop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compress' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz' } });
    expect(screen.getByText('No tool matches “xyz”.')).toBeInTheDocument();
  });

  it('runs a compress job built from the panel options and offers each result for download', async () => {
    const { harness, add } = setup();
    add(image('photo.jpg'), image('photo.jpg'));
    await screen.findByRole('radio', { name: /Target file size/ });
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '150' } });

    fireEvent.click(apply());

    expect(harness.createRunner).toHaveBeenCalledTimes(1);
    const job = harness.jobs[0]!;
    expect(job.images.map((i) => i.name)).toEqual(['photo.jpg', 'photo.jpg']);
    expect(job.pipeline.steps[0]).toMatchObject({ toolId: 'compress' });
    expect(job.pipeline.output).toMatchObject({ format: 'original', targetBytes: 150_000 });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    const [first, second] = job.images;
    act(() => {
      harness.events[0]!.onProgress?.(first!.id, 0.5, 0.25);
      harness.events[0]!.onResult?.(imageResult(first!.id, 400));
      harness.events[0]!.onResult?.(imageResult(second!.id, 600));
      harness.finish('done');
    });

    // The selected (first) image now has a download link; Apply is gone.
    const link = await screen.findByRole('link', { name: /Download/ });
    expect(link).toHaveAttribute('download', 'photo-reimage.jpg');
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByText(/2 done: 2\.0 KB → 1\.0 KB \(-50%\)/)).toBeInTheDocument();
    // Real numbers replace the preview estimate.
    expect(screen.getByText(/1\.0 KB →/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'photo.jpg' })[1]!);
    expect(await screen.findByRole('link', { name: /Download/ })).toHaveAttribute(
      'download',
      'photo-reimage (2).jpg',
    );
  });

  it('lets the options panel be hidden to give the canvas the full width', async () => {
    const { add } = setup();
    add(image('photo.jpg'));
    await screen.findByRole('radio', { name: /Target file size/ });

    const toggle = screen.getByRole('button', { name: 'Hide options' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);

    expect(screen.queryByRole('radio', { name: /Target file size/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Apply stays reachable while the panel is hidden.
    expect(apply()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
    expect(await screen.findByRole('radio', { name: /Target file size/ })).toBeInTheDocument();
  });

  it('offers every finished image for download from the filmstrip', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    const [first, second] = harness.jobs[0]!.images;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(first!.id, 400));
      harness.events[0]!.onResult?.(imageResult(second!.id, 600));
      harness.finish('done');
    });
    const strip = await screen.findByRole('region', { name: 'Images' });
    const links = within(strip).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('download'))).toEqual([
      'a-reimage.jpg',
      'b-reimage.jpg',
    ]);
  });

  it('flags results that missed the target or were made smaller to fit', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(
        imageResult(id, 1200, { targetMissed: true, downscaled: true }),
      );
      harness.finish('done');
    });
    expect(await screen.findByText('Could not reach the target size.')).toBeInTheDocument();
    expect(screen.getByText('Made slightly smaller to fit.')).toBeInTheDocument();
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();
  });

  it('shows a per-image failure without blocking the others', async () => {
    const { harness, add } = setup();
    add(image('good.jpg'), image('bad.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    const [good, bad] = harness.jobs[0]!.images;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(good!.id, 500));
      harness.events[0]!.onFailure?.({ imageId: bad!.id, error: new Error('Cannot decode') });
      harness.finish('done');
    });
    expect(await screen.findByRole('link', { name: /Download/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'bad.jpg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed: Cannot decode');
    // The failed image can be retried.
    expect(apply()).toBeEnabled();
  });

  it('cancel stops the job and returns unfinished images to the list', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(harness.cancel).toHaveBeenCalledTimes(1);
    act(() => harness.finish('cancelled'));
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('locks adding, removing and switching tools while a job runs', async () => {
    const { harness, add, input } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    expect(input()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove: a.jpg' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove all' })).toBeDisabled();
    expect(tool('Convert')).toBeDisabled();
    act(() => harness.finish('done'));
    expect(await screen.findByRole('button', { name: 'Convert' })).toBeEnabled();
  });

  it('blocks Apply when the options are invalid', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Target file size/ });
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '0' } });
    expect(apply()).toBeDisabled();
  });

  it('revokes object URLs when an image is removed and when the editor unmounts', async () => {
    const { harness, add, view } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(screen.getByRole('button', { name: 'Remove: a.jpg' }));
    expect(harness.revoked).toEqual(['blob:url-1']);

    fireEvent.click(apply());
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(id, 300));
      harness.finish('done');
    });
    await screen.findByRole('link', { name: /Download/ });

    view.unmount();
    // b's original and its result URL.
    expect(harness.revoked).toEqual(expect.arrayContaining(['blob:url-2', 'blob:url-3']));
    expect(harness.dispose).toHaveBeenCalledTimes(1);
  });

  it('drops results when the options change, so a stale file can never be downloaded', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(apply());
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(id, 300));
      harness.finish('done');
    });
    await screen.findByRole('link', { name: /Download/ });

    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: '30' } });
    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument();
    expect(harness.revoked).toContain('blob:url-2');
    expect(apply()).toBeEnabled();

    fireEvent.click(apply());
    expect(harness.jobs).toHaveLength(2);
    expect(harness.createRunner).toHaveBeenCalledTimes(1);
    act(() => harness.finish('done'));
  });

  it('converts with the chosen format and quality', async () => {
    const { harness, add } = setup();
    add(image('a.png', 'image/png'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(tool('Convert'));
    fireEvent.click(await screen.findByRole('radio', { name: 'AVIF' }));
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: '60' } });
    fireEvent.click(apply());

    const job = harness.jobs[0]!;
    expect(job.pipeline.steps[0]).toMatchObject({
      toolId: 'convert',
      options: { format: 'avif', quality: 60 },
    });
    expect(job.pipeline.output).toMatchObject({ format: 'avif', quality: 60 });

    const id = job.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(
        imageResult(id, 400, { blob: new Blob(['x'], { type: 'image/avif' }) }),
      );
      harness.finish('done');
    });
    expect(await screen.findByRole('link', { name: /Download/ })).toHaveAttribute(
      'download',
      'a-reimage.avif',
    );
  });

  it('hides the quality slider and sends no quality for PNG', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(tool('Convert'));
    fireEvent.click(await screen.findByRole('radio', { name: 'PNG' }));
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument();
    fireEvent.click(apply());
    expect(harness.jobs[0]!.pipeline.output).toMatchObject({ format: 'png' });
    expect(harness.jobs[0]!.pipeline.output.quality).toBeUndefined();
  });

  it('keeps the options of each tool when switching tools', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Target file size/ });
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '321' } });
    fireEvent.click(tool('Convert'));
    fireEvent.click(await screen.findByRole('radio', { name: 'JPEG' }));
    fireEvent.click(tool('Compress'));
    expect(await screen.findByLabelText(/Keep each file under/)).toHaveValue(321);
    fireEvent.click(tool('Convert'));
    expect(await screen.findByRole('radio', { name: 'JPEG' })).toBeChecked();
  });

  it('accepts HEIC photos and explains when the browser cannot open one', async () => {
    const { harness, add } = setup();
    add(image('IMG_0001.HEIC', ''), image('other.heif', 'image/heif'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    expect(screen.getByRole('button', { name: 'IMG_0001.HEIC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'other.heif' })).toBeInTheDocument();

    fireEvent.click(apply());
    const [first] = harness.jobs[0]!.images;
    act(() => {
      harness.events[0]!.onFailure?.({
        imageId: first!.id,
        error: new Error('The source image could not be decoded.'),
      });
      harness.finish('done');
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed: This browser cannot open HEIC photos.',
    );
  });

  describe('live preview', () => {
    it('renders a downscaled preview after the options settle and shows an estimated size', async () => {
      const { harness, add } = setup();
      add(image('a.jpg', 'image/jpeg', 4000));
      await screen.findByRole('radio', { name: /Fixed quality/ });
      await waitFor(() => expect(harness.previews).toHaveLength(1));
      expect(harness.previews[0]!.request).toMatchObject({
        file: expect.any(File),
        pipeline: { steps: [{ toolId: 'compress' }] },
      });
      // No workers beyond the lazily created runner, and no job was started.
      expect(harness.jobs).toHaveLength(0);

      await act(async () =>
        harness.previews[0]!.resolve(
          imageResult('x', 500, { width: 100, height: 50, previewScale: 0.5 }),
        ),
      );
      // 500 B at half size ≈ 2000 B at full size; dimensions scale back to 200x100.
      expect(await screen.findByText(/4\.0 KB →/)).toBeInTheDocument();
      expect(screen.getByText('≈2.0 KB')).toBeInTheDocument();
      expect(screen.getByText(/≈200×100/)).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: 'Before and after' })).toBeInTheDocument();
    });

    it('shows a preview failure without blocking Apply', async () => {
      const { harness, add } = setup();
      add(image('a.jpg'));
      await screen.findByRole('radio', { name: /Fixed quality/ });
      await waitFor(() => expect(harness.previews).toHaveLength(1));
      await act(async () => harness.previews[0]!.reject(new Error('Cannot decode')));
      expect(await screen.findByText('Preview failed: Cannot decode')).toBeInTheDocument();
      expect(apply()).toBeEnabled();
    });

    it('does not render previews while a job runs', async () => {
      const { harness, add } = setup();
      add(image('a.jpg'));
      await screen.findByRole('radio', { name: /Fixed quality/ });
      fireEvent.click(apply());
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(harness.previews).toHaveLength(0);
      act(() => harness.finish('done'));
    });
  });

  it('shows the crop box instead of the slider and writes drags back as percent', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
    fireEvent.click(tool('Crop'));
    fireEvent.click(await screen.findByRole('radio', { name: 'Free' }));

    // jsdom never loads images: report a natural size so the overlay mounts.
    const img = screen.getByRole('img', { name: 'a.jpg' });
    Object.defineProperty(img, 'naturalWidth', { value: 400 });
    Object.defineProperty(img, 'naturalHeight', { value: 300 });
    fireEvent.load(img);

    const box = await screen.findByRole('group', { name: 'Crop area' });
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(box).toHaveStyle({ left: '0%' }); // nothing to move yet: box is the whole image

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize crop: bottom right' }), {
      key: 'ArrowLeft',
      shiftKey: true,
    });
    expect(await screen.findByLabelText('Trim right (%)')).toHaveValue(10);
    expect(box).toHaveStyle({ width: '90%' });

    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(screen.getByLabelText('Trim left (%)')).toHaveValue(1);
    expect(screen.getByLabelText('Trim right (%)')).toHaveValue(9);
  });

  it('localises the editor', async () => {
    const { add } = setup('id');
    add(image('a.jpg'));
    expect(await screen.findByRole('button', { name: 'Terapkan' })).toBeEnabled();
    const rail = screen.getByRole('navigation', { name: 'Kategori alat' });
    expect(within(rail).getByRole('button', { name: 'Ekspor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kompres' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Cari alat' })).toBeInTheDocument();
  });
});

describe('Workspace on a phone', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the full-screen layout: tab bar, tool chips and an "n / N" marker', async () => {
    const { add } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    expect(screen.getByRole('navigation', { name: 'Tool categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compress' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // Desktop-only filmstrip is not rendered.
    expect(screen.queryByRole('region', { name: 'Images' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('does not change image when the compare slider is dragged', async () => {
    const { harness, add } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    await waitFor(() => expect(harness.previews).toHaveLength(1));
    await act(async () => harness.previews[0]!.resolve(imageResult('x', 500)));
    const slider = await screen.findByRole('slider', { name: 'Before and after' });
    const surface = slider.closest('.touch-none') as HTMLElement;
    surface.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect;
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 100 });
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 100 });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('swipes between images on the compare view', async () => {
    const { add } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    const canvas = screen.getByRole('region', { name: 'Editing canvas' });
    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 110 });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('picks an image from the sheet and closes it with Escape', async () => {
    const { add } = setup();
    add(image('a.jpg'), image('b.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(screen.getByRole('button', { name: /1 \/ 2/ }));
    const sheet = screen.getByRole('dialog', { name: 'All images' });
    fireEvent.click(within(sheet).getByRole('button', { name: /^b\.jpg/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2 \/ 2/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('searches tools from the top bar', async () => {
    const { add } = setup();
    add(image('a.jpg'));
    await screen.findByRole('radio', { name: /Fixed quality/ });
    fireEvent.click(screen.getByRole('button', { name: 'Search tools' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'siz' } });
    expect(screen.getByRole('button', { name: 'Resize' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compress' })).not.toBeInTheDocument();
  });
});
