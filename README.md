# re-image

**Every image tool you need, right in your browser. No uploads, no sign-up, no limits.**

re-image is a free, open-source image toolkit. It lets you compress, convert, resize, crop, expand, merge and more, on one image or a whole batch. All the work happens on your own device, so your photos never leave your computer or phone.

[Live app](https://re-image.example) · [Technical docs](./technical.md) · [Roadmap](#roadmap) · [Report a bug](../../issues/new)

---

## Why re-image?

| | re-image | Typical online image tools |
| --- | --- | --- |
| Where your images go | Stay on your device | Uploaded to a server |
| Account | Not needed | Often required |
| Daily or file limits | None (only your device's memory) | Common on free plans |
| Watermarks | Never | Sometimes |
| Works offline | Yes (installable app) | No |
| Batch processing | Yes, with reusable pipelines | Often paid |

## Features

### Available at launch (MVP)

- **Compress:** Use a quality slider, or set a **target file size** such as "under 200 KB".
- **Convert:** Convert between JPG, PNG, WebP and AVIF. HEIC input works where the browser supports it.
- **Resize:** Resize by pixels, percentage or preset (social media, passport photo, marketplace).
- **Crop:** Free crop or a fixed ratio, with presets.
- **Batch + ZIP:** Run any tool on many images and download everything as one ZIP.
- **Offline:** Install re-image as an app (PWA). It keeps working without internet.

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

Everything runs client-side. Heavy work happens in Web Workers, so the page stays responsive. Encoding uses WebAssembly codecs (MozJPEG, OxiPNG, WebP, AVIF), the same kind Squoosh uses. See [technical.md](./technical.md) for the full design.

## Privacy

- Images are **never uploaded**. An automated test in CI checks that no network request carries image data.
- No accounts and no cookies.
- Analytics are anonymous and cookie-free. They count pages and tool usage, never file names or contents.
- Saved presets live only in your browser (IndexedDB). Clearing your browser data removes them.

Read the full [Privacy Policy](https://re-image.example/privacy).

## Languages

- English
- Bahasa Indonesia

Want to add a language? See [Contributing](#contributing).

## Browser support

re-image supports the last 2 versions of Chrome, Edge, Firefox and Safari, plus Samsung Internet. If your browser can't do a feature (for example AVIF encoding), that option is hidden or explained.

## Getting started (development)

**Requirements:** Node.js 20+ and pnpm 9+

```bash
git clone https://github.com/<your-username>/re-image.git
cd re-image
pnpm install
pnpm dev          # start the dev server at http://localhost:5173
```

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Build for production into `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end, privacy and accessibility tests (Playwright) |
| `pnpm size` | Check bundle-size budget |

## Tech stack

TypeScript · React · Vite · Tailwind CSS · Zustand · Web Workers (Comlink) · WebAssembly codecs (jSquash) · fflate · IndexedDB · Workbox (PWA) · Vitest · Playwright · axe-core · GitHub Actions · Cloudflare Pages

## Project structure

```
src/
  app/       routing, layout, i18n
  core/      job runner, worker pool, pipeline, zip
  codecs/    WASM codec wrappers (lazy loaded)
  tools/     one folder per tool (compress, convert, resize, crop, ...)
  ui/        shared components and design tokens
  pages/     SEO landing pages per tool
docs/adr/    architecture decision records
e2e/         Playwright tests
```

## Roadmap

- [ ] **Phase 0, Foundations:** repo, CI, design tokens, plugin interface, docs
- [ ] **Phase 1, MVP:** compress, convert, resize, crop, batch, ZIP, PWA, SEO pages
- [ ] **Phase 2, v1:** editing tools, metadata strip, pipelines
- [ ] **Phase 3, Later:** background removal, compare slider, images to PDF, more languages

Have an idea? [Open a feature request](../../issues/new?labels=feature-request).

## Contributing

Contributions are welcome, from bug reports to new tools.

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).
2. Look for issues labelled `good first issue`.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`).
4. Open a PR. CI must pass (lint, types, tests, bundle size, accessibility).

Adding a new tool is one folder plus one registry line. See [Adding a tool](./technical.md#adding-a-new-tool).

## Support the project

re-image is free, and its core tools will stay free. If it saves you time, you can support it via GitHub Sponsors / Ko-fi / Saweria *(links coming soon)*.

## License

[MIT](./LICENSE) © re-image contributors

Third-party libraries and codecs keep their own licenses. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
