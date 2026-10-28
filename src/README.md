# Journal source map

- `core/`: the five shared ESM modules, plus `journal-runtime.js` (Core, RiskMath, emitted Worker and RiskStore). The runtime is a classic script fragment by design, embedded into the standalone V6.
- `views/classic/ClassicApp.tsx`: Classic's client view. `app/classic/page.tsx` is the framework entry; existing Classic components/CSS remain in `app/classic/` to preserve their imports and behavior.
- `views/v6/shell.html`: retained DOM/styles, with one application slot.
- `views/v6/app.js`: retained UI, pages, router and boot after the runtime.
- `../schema/`: persisted trade/rules contracts.

`node scripts/render-v6.mjs` assembles the authoritative sources into `v6/index.html`; deployment still uses a single HTML. `--check` and V6 verification reject ungenerated source edits. Do not hand-edit generated HTML. `lib/` shared ESM entries remain thin re-exports for old callers; no persisted keys change.

This extraction preserves P5's HTML byte for byte. It does not merge Classic's historical reporting engines into V6 or change formulas. Such work needs its own regression-backed scope.
