# reimage

**Every image tool you need, right in your browser. No uploads, no sign-up, no limits.**

reimage is a free, open-source image toolkit. It lets you compress, convert, resize, crop, expand, merge and more, on one image or a whole batch. All the work happens on your own device, so your photos never leave your computer or phone.

[Live app](https://reimage.awdi.my.id) · [Technical docs](./technical.md) · [Roadmap](./TODO.md) · [Report a bug](https://github.com/psudocode/reimage/issues/new)

---

## Why reimage?

|                      | reimage                          | Typical online image tools |
| -------------------- | -------------------------------- | -------------------------- |
| Where your images go | Stay on your device              | Uploaded to a server       |
| Account              | Not needed                       | Often required             |
| Daily or file limits | None (only your device's memory) | Common on free plans       |
| Watermarks           | Never                            | Sometimes                  |
| Works offline        | Yes (installable app)            | No                         |
| Batch processing     | Yes, with reusable pipelines     | Often paid                 |

## Features

### Available at launch (MVP)

- **Compress:** Use a quality slider, or set a **target file size** such as "under 200 KB".
- **Convert:** Convert between JPG, PNG, WebP and AVIF. HEIC input works where the browser supports it.
- **Resize:** Resize by pixels, percentage or preset (social media, passport photo, marketplace).
- **Crop:** Free crop (trim each edge by percent) or a fixed ratio (1:1, 4:3, 3:2, 16:9, portrait variants, custom), with a position control. Percent-based, so it works the same across a batch.
- **Batch + ZIP:** Run any tool on many images and download everything as one ZIP.
- **Offline:** Install reimage as an app (PWA). It keeps working without internet.

### Coming next (v1)

- Rotate and flip, with automatic EXIF orientation fix
- Expand canvas (padding or background colour)
- Merge and collage (side by side, stacked, grid)
- Watermark (text or logo)
- Strip metadata (EXIF and GPS location)
- **Pipelines:** Chain steps (crop → resize → compress → convert) and save them as presets

### Later

- Background removal (an ML model that runs in the browser)
- Before/after comparison slider
- Images to PDF

## How it works

```
Your files ──► Browser UI ──► Job runner ──► Worker pool ──► ZIP / download
                                               │
                              Tool plugins + WebAssembly codecs
```

The interface is an image editor: pick a tool from the category rail, adjust its options and watch a **live preview** (with a before/after slider, estimated file size, and an interactive crop box) before you apply it to the whole batch. On phones it switches to a full-screen layout with a bottom tab bar.

Everything runs client-side. Heavy work happens in Web Workers, so the page stays responsive. Encoding uses WebAssembly codecs (MozJPEG, OxiPNG, WebP, AVIF), the same kind Squoosh uses. See [technical.md](./technical.md) for the full design.

## Privacy

- Images are **never uploaded**. An automated test in CI checks that no network request carries image data.
- No accounts and no cookies.
- Analytics are anonymous and cookie-free. They count pages and tool usage, never file names or contents.
- Saved presets live only in your browser (IndexedDB). Clearing your browser data removes them.

Read the full [Privacy Policy](https://reimage.awdi.my.id/privacy).

## Languages

- English
- Bahasa Indonesia

Want to add a language? See [Contributing](#contributing).

## Browser support

reimage supports the last 2 versions of Chrome, Edge, Firefox and Safari, plus Samsung Internet. If your browser can't do a feature (for example AVIF encoding), that option is hidden or explained.

## Getting started (development)

**Requirements:** Node.js 20+ and pnpm 9+

```bash
git clone https://github.com/psudocode/reimage.git
cd reimage
pnpm install
pnpm dev          # start the dev server at http://localhost:5173
```

### Scripts

| Command          | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Start the dev server                                               |
| `pnpm build`     | Build for production into `dist/`                                  |
| `pnpm preview`   | Preview the production build                                       |
| `pnpm lint`      | ESLint + Prettier check                                            |
| `pnpm format`    | Format files with Prettier                                         |
| `pnpm typecheck` | TypeScript type check                                              |
| `pnpm test`      | Unit tests (Vitest)                                                |
| `pnpm size`      | Check bundle-size budget                                           |
| `pnpm test:e2e`  | End-to-end, privacy and accessibility tests (Playwright, Phase 1+) |

## Tech stack

TypeScript · React 19 · Vite · Tailwind CSS · Zustand · Web Workers (Comlink) · pica · WebAssembly codecs (jSquash) · fflate · IndexedDB (`idb-keyval`) · Workbox (PWA) · Vitest · Playwright · axe-core · GitHub Actions · Cloudflare Pages

## Project structure

```
src/
  app/       routing, layout, i18n
  core/      job runner, worker pool, pipeline, zip, limits
  codecs/    WASM codec wrappers (lazy loaded)
  tools/     one folder per tool (compress, convert, resize, crop, ...)
  ui/        shared components and design tokens
  pages/     SEO landing pages per tool
docs/adr/    architecture decision records
e2e/         Playwright tests
```

## Roadmap

See [TODO.md](./TODO.md) for the detailed checklist.

- [x] **Phase 0, Foundations:** repo, CI, design tokens, plugin interface, docs
- [ ] **Phase 1, MVP:** compress, convert, resize, crop, batch, ZIP, PWA, SEO pages
- [ ] **Phase 2, v1:** editing tools, metadata strip, pipelines
- [ ] **Phase 3, Later:** background removal, compare slider, images to PDF, more languages

Have an idea? [Open a feature request](https://github.com/psudocode/reimage/issues/new?labels=feature-request).

## Contributing

Contributions are welcome, from bug reports to new tools.

1. Look for issues labelled `good first issue`.
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`).
3. Open a PR. CI must pass (lint, types, tests, bundle size).

Adding a new tool is one folder plus one registry line. See [Adding a tool](./technical.md#adding-a-new-tool).

## Support the project

reimage is free, and its core tools will stay free. If it saves you time, you can support it via GitHub Sponsors / Ko-fi / Saweria _(links coming soon)_.

## License

MIT © reimage contributors _(LICENSE & THIRD_PARTY_NOTICES.md coming soon)_.

## End-to-end tests

Playwright runs against the production build (`pnpm test:e2e`; first time: `pnpm exec playwright install chromium`). Suites in `e2e/`: SEO metadata, the add → Compress → download flow, a privacy test (no request leaves the origin while an image is processed), and axe-core accessibility checks (WCAG 2.1 A/AA) on the landing page and the editor.
