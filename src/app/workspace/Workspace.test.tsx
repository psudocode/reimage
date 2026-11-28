import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobEvents, JobHandle, JobOutcome } from '../../core/job/JobRunner.ts';
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
  finish(status: JobOutcome['status']): void;
}

function makeHarness(): Harness {
  let counter = 0;
  let urls = 0;
  const jobs: Job[] = [];
  const events: JobEvents[] = [];
  const revoked: string[] = [];
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

describe('Workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty with the run button disabled', async () => {
    setup();
    expect(screen.getByText(/No images yet/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Compress' })).toBeDisabled();
  });

  it('lists accepted images and reports skipped ones', async () => {
    const { add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(
      image('a.jpg'),
      image('b.png', 'image/png'),
      image('c.gif', 'image/gif'),
      image('d.pdf', 'application/pdf'),
    );

    expect(screen.getByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
    expect(screen.queryByText('c.gif')).not.toBeInTheDocument();
    expect(screen.getByText(/^Skipped 2:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compress' })).toBeEnabled();
  });

  it('runs a compress job built from the panel options and shows results', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Target file size/ });
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '150' } });
    add(image('photo.jpg'), image('photo.jpg'));

    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));

    expect(harness.createRunner).toHaveBeenCalledTimes(1);
    const job = harness.jobs[0]!;
    expect(job.images.map((i) => i.name)).toEqual(['photo.jpg', 'photo.jpg']);
    expect(job.pipeline.steps[0]).toMatchObject({ toolId: 'compress' });
    expect(job.pipeline.output).toMatchObject({ format: 'original', targetBytes: 150_000 });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getAllByText('Processing')).toHaveLength(2);

    const [first, second] = job.images;
    act(() => {
      harness.events[0]!.onProgress?.(first!.id, 0.5, 0.25);
      harness.events[0]!.onResult?.(imageResult(first!.id, 400));
      harness.events[0]!.onResult?.(imageResult(second!.id, 600));
      harness.finish('done');
    });

    const links = await screen.findAllByRole('link', { name: /Download/ });
    expect(links.map((link) => link.getAttribute('download'))).toEqual([
      'photo-reimage.jpg',
      'photo-reimage (2).jpg',
    ]);
    expect(screen.getByText(/60% smaller/)).toBeInTheDocument();
    expect(screen.getByText(/2 done: 2\.0 KB → 1\.0 KB \(-50%\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compress' })).toBeEnabled();
  });

  it('flags results that did not shrink or missed the target', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(
        imageResult(id, 1200, { targetMissed: true, downscaled: true }),
      );
      harness.finish('done');
    });
    expect(await screen.findByText(/20% larger/)).toBeInTheDocument();
    expect(screen.getByText('Could not reach the target size.')).toBeInTheDocument();
    expect(screen.getByText('Made slightly smaller to fit.')).toBeInTheDocument();
  });

  it('shows a per-image failure without blocking the others', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('good.jpg'), image('bad.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    const [good, bad] = harness.jobs[0]!.images;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(good!.id, 500));
      harness.events[0]!.onFailure?.({ imageId: bad!.id, error: new Error('Cannot decode') });
      harness.finish('done');
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed: Cannot decode');
    expect(screen.getAllByRole('link', { name: /Download/ })).toHaveLength(1);
  });

  it('cancel stops the job and returns unfinished images to the list', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(harness.cancel).toHaveBeenCalledTimes(1);
    act(() => harness.finish('cancelled'));
    expect(await screen.findByRole('button', { name: 'Compress' })).toBeEnabled();
    expect(screen.queryByText('Processing')).not.toBeInTheDocument();
  });

  it('locks adding and removing while a job runs', async () => {
    const { harness, add, input } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    expect(input()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove: a.jpg' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove all' })).toBeDisabled();
    act(() => harness.finish('done'));
  });

  it('blocks the run when the options are invalid', async () => {
    const { add } = setup();
    await screen.findByRole('radio', { name: /Target file size/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Compress' })).toBeDisabled();
  });

  it('revokes object URLs when an image is removed and when the workspace unmounts', async () => {
    const { harness, add, view } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'), image('b.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove: a.jpg' }));
    expect(harness.revoked).toEqual(['blob:url-1']);

    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(id, 300));
      harness.finish('done');
    });
    await screen.findByRole('link', { name: /Download/ });

    view.unmount();
    // b's preview and its result URL.
    expect(harness.revoked).toEqual(expect.arrayContaining(['blob:url-2', 'blob:url-3']));
    expect(harness.dispose).toHaveBeenCalledTimes(1);
  });

  it('frees the previous result when the same images are compressed again', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(id, 300));
      harness.finish('done');
    });
    await screen.findByRole('link', { name: /Download/ });

    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    expect(harness.revoked).toContain('blob:url-2');
    expect(harness.createRunner).toHaveBeenCalledTimes(1);
    act(() => harness.finish('done'));
  });

  it('shows one tab per tool and starts on Compress', async () => {
    setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Compress',
      'Convert',
      'Resize',
    ]);
    expect(screen.getByRole('tab', { name: 'Compress' })).toHaveAttribute('aria-selected', 'true');
  });

  it('converts with the chosen format and quality', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.png', 'image/png'));
    fireEvent.click(screen.getByRole('tab', { name: 'Convert' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'AVIF' }));
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));

    const job = harness.jobs[0]!;
    expect(job.pipeline.steps[0]).toMatchObject({
      toolId: 'convert',
      options: { format: 'avif', quality: 60 },
    });
    expect(job.pipeline.output).toMatchObject({ format: 'avif', quality: 60 });
    expect(job.pipeline.output.targetBytes).toBeUndefined();

    const id = job.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(
        imageResult(id, 400, { blob: new Blob(['x'], { type: 'image/avif' }) }),
      );
      harness.finish('done');
    });
    const link = await screen.findByRole('link', { name: /Download/ });
    expect(link).toHaveAttribute('download', 'a-reimage.avif');
  });

  it('hides the quality slider and sends no quality for PNG', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('tab', { name: 'Convert' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'PNG' }));
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(harness.jobs[0]!.pipeline.output).toMatchObject({ format: 'png' });
    expect(harness.jobs[0]!.pipeline.output.quality).toBeUndefined();
  });

  it('keeps the options of each tool when switching tabs', async () => {
    setup();
    await screen.findByRole('radio', { name: /Target file size/ });
    fireEvent.click(screen.getByRole('radio', { name: /Target file size/ }));
    fireEvent.change(screen.getByLabelText(/Keep each file under/), { target: { value: '321' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Convert' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'JPEG' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Compress' }));
    expect(await screen.findByLabelText(/Keep each file under/)).toHaveValue(321);
    fireEvent.click(screen.getByRole('tab', { name: 'Convert' }));
    expect(await screen.findByRole('radio', { name: 'JPEG' })).toBeChecked();
  });

  it('locks the tabs while a job runs', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    expect(screen.getByRole('tab', { name: 'Convert' })).toBeDisabled();
    act(() => harness.finish('done'));
    expect(await screen.findByRole('tab', { name: 'Convert' })).toBeEnabled();
  });

  it('accepts HEIC photos and explains when the browser cannot open one', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('IMG_0001.HEIC', ''), image('other.heif', 'image/heif'));
    expect(screen.getByText('IMG_0001.HEIC')).toBeInTheDocument();
    expect(screen.getByText('other.heif')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
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

  it('reports a same-size result', async () => {
    const { harness, add } = setup();
    await screen.findByRole('radio', { name: /Fixed quality/ });
    add(image('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Compress' }));
    const id = harness.jobs[0]!.images[0]!.id;
    act(() => {
      harness.events[0]!.onResult?.(imageResult(id, 1000));
      harness.finish('done');
    });
    expect(await screen.findByText(/same size as the original/)).toBeInTheDocument();
  });

  it('localises the workspace', async () => {
    setup('id');
    expect(await screen.findByRole('button', { name: 'Kompres' })).toBeDisabled();
    expect(screen.getByText(/Belum ada gambar/)).toBeInTheDocument();
    const aside = screen.getByRole('complementary', { name: 'Opsi' });
    expect(within(aside).getByRole('tab', { name: 'Kompres' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(aside).getByRole('tab', { name: 'Konversi' })).toBeInTheDocument();
  });
});
