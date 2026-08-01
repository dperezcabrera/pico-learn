"""course-qa: every lab of every course must run green against the pinned wheels.

Mirrors the in-browser runner: each lab gets an environment holding exactly the
packages it declares (the browser gives every course its own Pyodide
interpreter), files land in a flat directory, the solution (when present)
overrides the starter files, then pytest runs the test_* file or main.py
executes with top-level await allowed. Run from the repo root:

    python scripts/course-qa.py            # all courses
    python scripts/course-qa.py pico-ioc   # one course

Environments are built once per distinct package set and reused, so a full run
creates a handful of them rather than one per lab.
"""

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
PINS = json.loads((PUBLIC / "pins.json").read_text(encoding="utf-8"))

# Always available: the runner itself needs pytest, and lessons that exercise
# HTTP endpoints use the fastapi TestClient, which needs httpx.
BASE_PACKAGES = ("pytest", "pytest-asyncio", "httpx")

RUNNER = """
import ast, asyncio, inspect, sys

source = open("main.py", encoding="utf-8").read()
code = compile(source, "main.py", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
result = eval(code, {"__name__": "__main__"})
if inspect.iscoroutine(result):
    asyncio.run(result)
"""

_envs: dict[frozenset, pathlib.Path] = {}
_uv = shutil.which("uv")


def _pin(package: str) -> str:
    """pins.json freezes the versions the lessons are validated against."""
    return f"{package}=={PINS[package]}" if package in PINS else package


def environment_for(packages: frozenset, root: pathlib.Path) -> pathlib.Path:
    """Return the interpreter of an environment holding exactly *packages*."""
    if packages in _envs:
        return _envs[packages]

    venv = root / f"env{len(_envs)}"
    to_install = [_pin(p) for p in sorted(packages | set(BASE_PACKAGES))]
    if _uv:
        subprocess.run([_uv, "venv", "-q", str(venv)], check=True)
        python = venv / "bin" / "python"
        subprocess.run([_uv, "pip", "install", "-q", "--python", str(python), *to_install], check=True)
    else:
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
        python = venv / "bin" / "python"
        subprocess.run([str(python), "-m", "pip", "install", "-q", *to_install], check=True)

    _envs[packages] = python
    return python


def run_lab(level: dict, root: pathlib.Path) -> tuple[bool, str]:
    files = {f["name"]: f["content"] for f in level.get("files", [])}
    files.update(level.get("solution") or {})
    if not files:
        return True, "sin ficheros"

    python = environment_for(frozenset(level.get("packages") or []), root)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = pathlib.Path(tmp)
        for name, content in files.items():
            (tmpdir / name).write_text(content, encoding="utf-8")

        test_file = next((n for n in files if n.startswith("test_")), None)
        if test_file:
            cmd = [str(python), "-m", "pytest", "-q", test_file]
        elif "main.py" in files:
            (tmpdir / "_qa_runner.py").write_text(RUNNER, encoding="utf-8")
            cmd = [str(python), "_qa_runner.py"]
        else:
            return False, "sin entrypoint (main.py o test_*)"

        proc = subprocess.run(
            cmd,
            cwd=tmpdir,
            capture_output=True,
            text=True,
            timeout=180,
            # no PICO_BOOT_AUTO_PLUGINS here: isolation comes from the
            # environment holding only this lab's packages, and the marker
            # lesson asserts on the var
            env={"PATH": "/usr/bin:/bin", "HOME": tmp},
        )
        tail = (proc.stdout + proc.stderr).strip().splitlines()[-12:]
        return proc.returncode == 0, "\n".join(tail)


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    failures = 0
    labs = 0
    with tempfile.TemporaryDirectory() as envroot:
        root = pathlib.Path(envroot)
        for course_file in sorted(PUBLIC.glob("course-*.json")):
            name = course_file.stem.removeprefix("course-")
            if only and only not in name:
                continue
            course = json.loads(course_file.read_text(encoding="utf-8"))
            for level in course["levels"]:
                if level.get("type") != "lab":
                    continue
                labs += 1
                ok, detail = run_lab(level, root)
                status = "ok" if ok else "FALLO"
                print(f"[{status}] {name} / nivel {level['id']}: {level['title']}")
                if not ok:
                    failures += 1
                    print("    " + detail.replace("\n", "\n    "))
        print(f"\ncourse-qa: {labs - failures}/{labs} labs en verde "
              f"({len(_envs)} entornos, {'uv' if _uv else 'venv+pip'})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
