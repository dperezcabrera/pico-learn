Read and follow ./AGENTS.md for project conventions.

## Pico Ecosystem Context

pico-learn is the **interactive learning environment** for the pico
ecosystem. It runs entirely in the browser via Pyodide (Python in
WASM) — no server, no backend, no runtime dependency on any pico-*
package. The course content (under `components/courses/`) is
hand-curated to teach the patterns of pico-ioc, pico-fastapi,
pico-sqlalchemy, pico-pydantic, and pico-celery through
incrementally complex examples.

The pico-* packages themselves are NOT runtime dependencies here —
they're loaded by Pyodide at lesson time as wheels. This means
pico-learn stays evergreen against ecosystem changes: bump the
pinned wheel versions in the loader and the lessons keep working.

## Key Reminders

- **No runtime pico-* deps in package.json.** Pico packages are
  installed by Pyodide inside the browser at lesson load.
- **TypeScript + React 19 + Vite + CodeMirror.** Lessons render via
  ReactFlow for diagrams.
- **Educational tone first.** Code samples should compile and run
  in Pyodide; broken samples that "illustrate" something are not
  acceptable here.
- **Versioning:** the project stays at `0.0.0` because content is
  continuously updated; treat each commit to `main` as the live
  version on GitHub Pages.
- **Deploy target:** GitHub Pages
  (https://dperezcabrera.github.io/pico-learn/). The CI workflow
  publishes on push to `main`.
- Lesson files: `components/courses/<package>/lesson<N>.tsx` —
  follow the existing pattern (intro markdown, code block, expected
  output, "try it" button that runs in Pyodide).

## What it's NOT

- Not a place to test new pico-* features in the wild — use the
  package's own tests for that.
- Not a backend / API — there's no server.
- Not a docs site — for reference docs, see each package's `docs/`
  via mkdocs.
