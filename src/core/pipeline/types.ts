export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'original';

export interface InputImage {
  id: string;
  file: File;
  name: string;
  size: number;
  width?: number;
  height?: number;
}

export interface PipelineStep<O = unknown> {
  toolId: string;
  options: O;
}

export interface OutputSettings {
  format: OutputFormat;
  quality?: number;
  targetBytes?: number;
  stripMetadata: boolean;
  fileNamePattern: string;
}

export interface Pipeline {
  version: 1;
  steps: PipelineStep[];
  output: OutputSettings;
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  images: InputImage[];
  pipeline: Pipeline;
  status: JobStatus;
}

export interface ImageResult {
  imageId: string;
  blob: Blob;
  width: number;
  height: number;
  bytesBefore: number;
  bytesAfter: number;
  ms: number;
  /** True when the image was downscaled to fit memory limits (e.g. after a worker crash). */
  downscaled?: boolean;
  /** True when a target file size was requested but could not be reached. */
  targetMissed?: boolean;
}

export interface Env {
  offscreenCanvas: boolean;
  avifDecode: boolean;
  heicDecode: boolean;
  wasmSimd: boolean;
  deviceMemory: number;
}
