#!/usr/bin/env python3
"""
test_gate.py — assert that evaluate_gate.py reaches the right verdicts.

The threshold table lives in hardware_compute ARTIFACT B and is easy to edit by hand.
These cases pin the behaviour that matters on this machine: AC is required for sustained
work, a throttling laptop is denied, an unverifiable thermal reading closes the gate, one
readable reading is enough, and one heavy job runs at a time.

    python3 tools/hw/test_gate.py

Exit 0 = all cases behave as specified.
"""

import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EVAL = ROOT / "tools" / "hw" / "evaluate_gate.py"

HEALTHY = {
    "workload": "generic",
    "host": {"name": "YOGA", "kind": "windows", "machine": "Yoga Book 9 14IMU9"},
    "gpu": {"status": "integrated", "name": "Intel Arc Graphics", "vram_total_gb": None,
            "memory_shared_with_system": True},
    "memory": {"total_gb": 16, "available_gb": 11, "free_pct": 68, "swap_used_mb": 1800,
               "dynamic_claim_limit_gb": 6},
    "power": {"source": "ac", "battery_pct": 88},
    "thermal": {"cpu_temp_c": None, "cpu_perf_pct": 94},
    "disk": {"free_gb": 180, "system_free_gb": 180},
}

CASES = [
    ("healthy laptop runs the small model", "llm_local_sm", {}, "PASS"),
    ("one readable thermal reading is enough", "render_3d_cpu", {}, "PASS"),
    ("both thermal readings unreadable closes the gate", "llm_local_sm",
     {"thermal": {"cpu_temp_c": None, "cpu_perf_pct": None}}, "DENY"),
    ("battery denies sustained work", "render_3d_cpu",
     {"power": {"source": "battery", "battery_pct": 41}}, "DENY"),
    ("battery still allows the small model", "llm_local_sm",
     {"power": {"source": "battery", "battery_pct": 41}}, "PASS"),
    ("a throttling machine is denied", "render_3d_cpu",
     {"thermal": {"cpu_temp_c": 91, "cpu_perf_pct": 58}}, "DENY"),
    ("16 GB cannot hold the md tier while Adobe is open", "llm_local_md",
     {"memory": {"total_gb": 16, "available_gb": 4, "free_pct": 25, "swap_used_mb": 7000,
                 "dynamic_claim_limit_gb": 2}}, "DENY"),
    ("a discrete GPU means the wrong machine", "render_3d_cpu",
     {"gpu": {"status": "discrete", "name": "RTX 4070", "vram_total_gb": 8,
              "memory_shared_with_system": False}}, "DENY"),
    ("macOS is not a supported host any more", "llm_local_sm",
     {"host": {"name": "mac", "kind": "macos", "machine": "Mac Studio"}}, "DENY"),
]


def verdict(probe, workload, extra_args=()):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        probe = dict(probe, ts_epoch=int(time.time()))
        json.dump(probe, f)
        path = f.name
    out = subprocess.run(
        [sys.executable, str(EVAL), workload, "--probe", path, "--dry-run", *extra_args],
        capture_output=True, text=True)
    Path(path).unlink(missing_ok=True)
    if f"  {workload}  —  PASS" in out.stdout:
        return "PASS", out.stdout
    if f"  {workload}  —  DENY" in out.stdout:
        return "DENY", out.stdout
    return f"ERROR(rc={out.returncode})", out.stdout + out.stderr


def main():
    failures = 0
    for name, workload, override, want in CASES:
        probe = json.loads(json.dumps(HEALTHY))
        probe.update(override)
        got, output = verdict(probe, workload)
        mark = "ok  " if got == want else "FAIL"
        if got != want:
            failures += 1
        print(f"  {mark}  {name}  [{workload} -> {got}]")
        if got != want:
            print("        expected", want)
            print("\n".join("        " + l for l in output.strip().splitlines()))

    # single_flight_law needs a token on disk, so it is exercised separately: --dry-run
    # deliberately skips the check, and a live token must not be minted by a test run.
    token = ROOT / "state" / "compute_gate.json"
    backup = token.read_text() if token.exists() else None
    try:
        token.parent.mkdir(parents=True, exist_ok=True)
        token.write_text(json.dumps({
            "verdict": "PASS", "workload": "llm_local_sm", "ts_epoch": int(time.time()),
            "ttl_seconds": 1800, "consumed_by": None}))
        probe = json.loads(json.dumps(HEALTHY))
        probe["ts_epoch"] = int(time.time())
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(probe, f)
            path = f.name
        out = subprocess.run([sys.executable, str(EVAL), "render_3d_cpu", "--probe", path],
                             capture_output=True, text=True)
        Path(path).unlink(missing_ok=True)
        held = "single_flight_law" in out.stdout
        print(f"  {'ok  ' if held else 'FAIL'}  a live token blocks a second workload "
              f"[render_3d_cpu -> {'DENY' if held else 'PASS'}]")
        if not held:
            failures += 1
    finally:
        if backup is not None:
            token.write_text(backup)
        elif token.exists():
            token.unlink()

    print(f"\n  {len(CASES) + 1 - failures} passed, {failures} failed\n")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
