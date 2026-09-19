---
name: doorvisor-screen
description: "Conventions for building any Doorvisor mobile-app screen in this repo from a Figma design. Trigger whenever the user shares a figma.com link for this project, or asks to build/add/update a screen, component, or the logo for Doorvisor. Also trigger for 'implement this screen', 'add the next screen', 'match this Figma frame'."
disable-model-invocation: false
---

# Doorvisor screen builder

## Stack (do not change without being asked)

- Vite + React + TypeScript, functional components only.
- Tailwind CSS v4 via `@tailwindcss/postcss` (imported with `@import "tailwindcss";` in `src/index.css`). No CSS modules, no styled-components, no Tailwind config file needed for v4.
- Icons are hand-written inline SVG components in `src/components/icons.tsx` — never `<img>` tags pointing at Figma's temporary asset URLs.
- One `App.tsx`-level component per screen unless the user asks for routing; when multiple screens exist, put each in `src/screens/<Name>.tsx` and keep shared icons/tokens in `src/components/`.

## Design tokens already established (reuse, don't reinvent)

- Page background: `#e4e9f2`. Card/screen background: `#f0f3f8`.
- Primary text: `#010028` (use `/40`, `/80` opacity modifiers for secondary text).
- Brand gradient: `linear-gradient(140deg, #67A0FF 0%, #183EEB 92%)` — used on the logo badge and the send button.
- Card shell: `max-w-[400px]`, `rounded-[36px]`, centered with `flex items-center justify-center` on the page wrapper.
- Pills / suggestion chips: `rounded-full border border-[#67a0ff] bg-white/60`.

## Workflow for each new screen

1. Get the exact node with `mcp__Figma__get_design_context` (pass `nodeId` + `fileKey` parsed from the URL the user gives you, and `skillNames` including `figma-design-to-code`). Always request the screenshot.
2. **Read the screenshot as ground truth for visual order and z-position.** Figma's absolute `top`/`bottom` coordinates in the generated code are the source of truth for stacking order — don't assume typical layout conventions (e.g. don't assume a chat input always goes at the very bottom; check the actual pixel order in this design).
3. **Known environment limitation:** this sandbox's egress proxy blocks `figma.com`, so Figma's temporary asset URLs (icons/images) cannot be downloaded here. Work around it:
   - Recreate simple icons as inline SVG in `src/components/icons.tsx`, matching the visual style already used there (stroke icons at `strokeWidth="1.5"`, `#010028` at 55% opacity for outline icons; filled brand-gradient icons for CTAs).
   - For photos, reference a stable external URL (e.g. Unsplash) directly in `src/`; it won't render in this sandbox's own preview but will render fine for real visitors once deployed, since the block is only on this container's outbound proxy, not the live site.
   - If the user later attaches an actual logo/icon image directly in chat, crop/zoom it with Python+Pillow (`pip install Pillow`) to inspect details before redrawing as SVG — don't guess from the thumbnail.
4. Convert absolute Figma positioning into normal flow (flexbox), matching proportions rather than copying pixel coordinates literally.
5. Build, then verify visually before pushing:
   ```bash
   npm run build
   npm run dev -- --port 5183 --host &
   ```
   Screenshot with Playwright (chromium is pre-installed at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; scripts must be `.cjs` since the project is `"type": "module"`) and compare against the Figma screenshot before calling it done. Kill the dev server and delete scratch scripts/screenshots afterward — never commit them.
6. Commit and `git push origin <current-branch>` directly — the GitHub App has write access to this repo already.

## Non-goals

- Don't add a router, state library, or backend unless asked — this is a static prototype.
- Don't restructure already-approved screens while building a new one; scope changes to what was asked.
