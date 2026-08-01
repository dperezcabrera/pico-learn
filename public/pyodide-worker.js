/* Pyodide runs here, off the main thread.
 *
 * A lesson is student code: a stray `while True:` is a normal mistake, and on
 * the main thread it freezes the tab for good. In a worker the page stays
 * responsive and the run can be cancelled by terminating this thread.
 *
 * Protocol: the page posts {id, type, ...} and gets back {id, ok, ...} plus
 * unsolicited {type: "stdout" | "stderr" | "graph"} messages while code runs.
 */

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

const GRAPH_PREFIX = "__GRAPH_DATA__:";

let pyodide = null;
const installed = new Set();

function emit(text, stream) {
  const lines = text.split("\n");
  let out = "";
  for (const line of lines) {
    if (line.startsWith(GRAPH_PREFIX)) {
      self.postMessage({ type: "graph", json: line.slice(GRAPH_PREFIX.length) });
    } else if (line.trim()) {
      out += line + "\n";
    }
  }
  if (out) self.postMessage({ type: stream, text: out });
}

async function boot() {
  if (pyodide) return;
  pyodide = await loadPyodide();
  pyodide.setStdout({ batched: (s) => emit(s, "stdout") });
  pyodide.setStderr({ batched: (s) => emit(s + "\n", "stderr") });
  await pyodide.loadPackage("micropip");
}

async function install(packages, pins) {
  const fresh = packages.filter((p) => !installed.has(p));
  if (fresh.length === 0) return { installed: [] };
  const pinned = fresh.map((p) => (pins && pins[p] ? `${p}==${pins[p]}` : p));
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(pinned);
  fresh.forEach((p) => installed.add(p));
  return { installed: fresh };
}

async function run(files) {
  // Only the lesson's own modules are dropped: a stale `app` from the previous
  // run would shadow the edit the student just made.
  const names = files.map((f) => f.name.replace(/\.py$/, ""));
  await pyodide.runPythonAsync(`
import sys
for _m in ${JSON.stringify(names)}:
    sys.modules.pop(_m, None)
`);

  for (const file of files) {
    pyodide.FS.writeFile(file.name, file.content);
  }

  const testFile = files.find((f) => f.name.startsWith("test_"));
  const mainFile = files.find((f) => f.name === "main.py");

  if (testFile) {
    self.postMessage({ type: "stdout", text: `\n> Running tests in ${testFile.name}...\n` });
    const pytest = pyodide.pyimport("pytest");
    const exitCode = await pytest.main(pyodide.toPy(["-v", testFile.name]), null);
    return { passed: exitCode === 0 };
  }
  if (mainFile) {
    self.postMessage({ type: "stdout", text: `\n> Running ${mainFile.name}...\n\n` });
    await pyodide.runPythonAsync(mainFile.content);
    return { passed: true };
  }
  return { passed: false, detail: "No entrypoint found (e.g., main.py or test_*.py)" };
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    let result = {};
    if (type === "boot") await boot();
    else if (type === "install") result = await install(payload.packages, payload.pins);
    else if (type === "run") result = await run(payload.files);
    else throw new Error(`unknown message: ${type}`);
    self.postMessage({ id, ok: true, ...result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message || String(error) });
  }
};
