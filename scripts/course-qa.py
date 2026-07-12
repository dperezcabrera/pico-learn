"""course-qa: every lab of every course must run green against the pinned wheels.

Mirrors the in-browser runner: files land in a flat directory, the solution
(when present) overrides the starter files, then pytest runs the test_* file
or main.py executes with top-level await allowed. Run from the repo root:

    python scripts/course-qa.py            # all courses
    python scripts/course-qa.py pico-ioc   # one course
"""

import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

RUNNER = """
import ast, asyncio, inspect, sys

source = open("main.py", encoding="utf-8").read()
code = compile(source, "main.py", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
result = eval(code, {"__name__": "__main__"})
if inspect.iscoroutine(result):
    asyncio.run(result)
"""


def run_lab(course: str, level: dict) -> tuple[bool, str]:
    files = {f["name"]: f["content"] for f in level.get("files", [])}
    files.update(level.get("solution") or {})
    if not files:
        return True, "sin ficheros"

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = pathlib.Path(tmp)
        for name, content in files.items():
            (tmpdir / name).write_text(content, encoding="utf-8")

        test_file = next((n for n in files if n.startswith("test_")), None)
        if test_file:
            cmd = [sys.executable, "-m", "pytest", "-q", test_file]
        elif "main.py" in files:
            (tmpdir / "_qa_runner.py").write_text(RUNNER, encoding="utf-8")
            cmd = [sys.executable, "_qa_runner.py"]
        else:
            return False, "sin entrypoint (main.py o test_*)"

        proc = subprocess.run(
            cmd,
            cwd=tmpdir,
            capture_output=True,
            text=True,
            timeout=120,
            # no PICO_BOOT_AUTO_PLUGINS here: isolation comes from the
            # pico-testing plugin, and the marker lesson asserts on the var
            env={"PATH": "/usr/bin:/bin", "HOME": tmp},
        )
        tail = (proc.stdout + proc.stderr).strip().splitlines()[-12:]
        return proc.returncode == 0, "\n".join(tail)


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    failures = 0
    labs = 0
    for course_file in sorted(PUBLIC.glob("course-*.json")):
        name = course_file.stem.removeprefix("course-")
        if only and only not in name:
            continue
        course = json.loads(course_file.read_text(encoding="utf-8"))
        for level in course["levels"]:
            if level.get("type") != "lab":
                continue
            labs += 1
            ok, detail = run_lab(name, level)
            status = "ok" if ok else "FALLO"
            print(f"[{status}] {name} / nivel {level['id']}: {level['title']}")
            if not ok:
                failures += 1
                print("    " + detail.replace("\n", "\n    "))
    print(f"\ncourse-qa: {labs - failures}/{labs} labs en verde")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
