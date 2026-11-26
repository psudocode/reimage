/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { ImageResult } from '../pipeline/types.ts';
import { getToolById } from '../../tools/registry.ts';
import { createBrowserDeps, processImage, type ProcessRequest } from './processImage.ts';

export interface ImageWorkerApi {
  process(request: ProcessRequest, onProgress: (fraction: number) => void): Promise<ImageResult>;
}

// `navigator.deviceMemory` is Chromium-only; assume the conservative 4 GB elsewhere.
const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
const deps = createBrowserDeps(getToolById, deviceMemoryGb);

const api: ImageWorkerApi = {
  process: (request, onProgress) => processImage(request, onProgress, deps),
};

Comlink.expose(api);
