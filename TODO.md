# reimage — Roadmap

## Phase 0: Foundations

- [x] Repository setup, TypeScript (`strict: true`), React 19, Vite, Tailwind CSS
- [x] ESLint + Prettier + Vitest + `size-limit`
- [x] GitHub Actions CI (`lint`, `typecheck`, `test`, `build`, `size`)
- [x] Design tokens (`src/ui/tokens.ts`), plugin interface (`ImageTool`), memory guards (`src/core/limits.ts`)
- [x] i18n scaffolding (`en.json`, `id.json`) and initial ADR

## Phase 1: MVP

- [ ] Worker pool (`Comlink`) + `JobRunner` + `pica` resampling helper
- [ ] Lazy-loaded WASM codecs (`@jsquash/jpeg`, `/png`, `/oxipng`, `/webp`, `/avif`)
- [ ] **Compress** tool (quality slider + target file size binary search)
- [ ] **Convert** tool (JPG, PNG, WebP, AVIF; HEIC input where supported)
- [ ] **Resize** tool (pixels, percentage, presets)
- [ ] **Crop** tool (free crop + fixed ratio presets)
- [ ] Batch processing + ZIP export (`fflate`)
- [ ] PWA + offline support (`vite-plugin-pwa`)
- [ ] SEO landing pages + Playwright E2E, privacy, and accessibility (`axe-core`) tests

## Phase 2: v1

- [ ] Rotate & flip with automatic EXIF orientation fix
- [ ] Expand canvas (padding / background color)
- [ ] Merge & collage (side by side, stacked, grid)
- [ ] Watermark (text or logo)
- [ ] Strip metadata (EXIF & GPS)
- [ ] Pipelines (chain steps + IndexedDB presets via `idb-keyval`)

## Phase 3: Later

- [ ] Browser-based background removal (ML)
- [ ] Before/after comparison slider
- [ ] Images to PDF
- [ ] Additional languages
