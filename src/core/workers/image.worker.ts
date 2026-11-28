/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { ImageResult } from '../pipeline/types.ts';
import { getToolRuntimeById } from '../../tools/runtimeRegistry.ts';
import { createBrowserDeps, processImage, type ProcessRequest } from './processImage.ts';
import { processMany, type ProcessManyRequest } from './processMany.ts';

export interface ImageWorkerApi {
  process(request: ProcessRequest, onProgress: (fraction: number) => void): Promise<ImageResult>;
  /** Many images in, one image out (merge, collage). */
  processMany(
    request: ProcessManyRequest,
    onProgress: (fraction: number) => void,
  ): Promise<ImageResult>;
}

// `navigator.deviceMemory` is Chromium-only; assume the conservative 4 GB elsewhere.
const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
const deps = createBrowserDeps(getToolRuntimeById, deviceMemoryGb);

const api: ImageWorkerApi = {
  process: (request, onProgress) => processImage(request, onProgress, deps),
  processMany: (request, onProgress) => processMany(request, onProgress, deps),
};

Comlink.expose(api);
