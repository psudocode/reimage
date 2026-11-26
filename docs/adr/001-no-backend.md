# ADR 001: No Backend — Client-Side Processing Only

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Most online image tools upload user photos to remote servers, creating privacy risks, server compute/bandwidth costs, and artificial file/daily limits.

## Decision

All image decoding, manipulation, and encoding in `reimage` runs 100% client-side in the user's browser using Web Workers, Canvas/`OffscreenCanvas`, `pica`, and lazy-loaded WebAssembly codecs. There is no backend and no server-side database.

## Consequences

- **Privacy:** User images never leave the device; enforced by automated network-interception tests in CI.
- **Cost:** Static hosting only (Cloudflare Pages free tier).
- **Constraints:** Performance and memory are bounded by the user's device, requiring worker pool caps, eager `ImageBitmap.close()`, and dimension guards (`src/core/limits.ts`).
