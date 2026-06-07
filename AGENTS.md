# Contributing to pico-learn

## What this is

A static React/Vite app that runs Python lessons in the browser via
Pyodide. Pure content + thin app shell.

## Workflow

- **Add a lesson**: create `components/courses/<package>/lesson<N>.tsx`
  following the existing template. Verify it runs in Pyodide
  locally (`npm run dev`).
- **Add a course**: create the directory + register the course in
  the index. Update README's table.
- **Bump a Pyodide-installed wheel version**: search for the wheel
  URL/version in the loader and update.

## Project conventions

- Lessons must be self-contained. No external HTTP calls; all
  imports satisfied by Pyodide-installed wheels.
- TypeScript strict mode; CodeMirror for code editors with the
  GitHub theme.
- Diagrams: ReactFlow. Don't reach for other graph libs without
  discussion.
- Stay evergreen: when a pico-* package releases a breaking change,
  update the lesson code AND the pinned wheel in the loader in the
  same commit.

## Commit messages

One line, present tense. Examples:
- `add lesson on @configured tree mapping`
- `fix lesson 4 broken import after pico-ioc 2.3 release`
- `update pico-fastapi wheel to 0.4.0`

## Tests

None. The lessons themselves are the verification: if a lesson runs
to completion in Pyodide and produces the expected output, it's
correct. CI may run `npm run build` to check the bundle compiles.

## Deploy

GitHub Pages on push to `main` via `.github/workflows/`. URL:
https://dperezcabrera.github.io/pico-learn/
