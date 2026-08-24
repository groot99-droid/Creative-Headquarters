#!/usr/bin/env python3
"""
evaluate_gate.py — turn a hardware probe into a gate verdict.

`hardware_compute` §2 says "compare probe JSON against ARTIFACT B thresholds". That
sentence was addressed to an agent reading the skill file; nothing executed it, so the
gate was a specification rather than a mechanism. This is the mechanism.

The thresholds are NOT duplicated here. They are parsed out of ARTIFACT B in
skills/hardware_compute.skill.md at run time, so the skill file stays the single source
of truth and this script cannot silently drift from it.

    python3 tools/hw/evaluate_gate.py llm_local_sm
    python3 tools/hw/evaluate_gate.py --all --dry-run     # what would pass right now
    python3 tools/hw/evaluate_gate.py render_3d_cpu --consume blender_python

Exit 0 = PASS (token minted unless --dry-run), 1 = DENY, 2 = could not evaluate.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SKILL = ROOT / "skills" / "hardware_compute.skill.md"
PROBE = ROOT / "state" / "hw_probe_latest.json"
TOKEN = ROOT / "state" / "compute_gate.json"

SUPPORTED_HOSTS = {"windows", "wsl", "linux"}
# The two readings the thermal_law pairs. Handled together, never by the generic
# null-is-failure rule: on consumer Windows hardware the temperature sensor is routinely
# unreadable, and failing on that alone would close the gate permanently.
THERMAL_KEYS = ("thermal.cpu_temp_c_max", "thermal.cpu_perf_pct_min")

# Failure signature -> remedy key in ARTIFACT B. Explicit, and ordered most specific
# first: matching remedies by loose word overlap printed "on battery" for a single-flight
# denial, because "on" is a substring of "one".
REMEDY_FOR = [
    ("single_flight_law", "single-flight deny"),
    ("thermal_law", "thermal unreadable (both null)"),
    ("gpu.status=discrete", "gpu discrete unexpectedly"),
    ("thermal.cpu_perf_pct", "cpu_perf_pct low"),
    ("power.source", "on battery"),
    ("memory.available_gb", "low available_gb"),
    ("memory.free_pct", "low available_gb"),
    ("memory.swap_used_mb", "swap rising"),
    ("disk.free_gb", "low disk"),
]


def die(msg, code=2):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def load_law():
    """ARTIFACT B, parsed from the skill file rather than copied into this script."""
    if not SKILL.exists():
        die(f"{SKILL} not found")
    m = re.search(r"### ARTIFACT B.*?\n```json\n(.*?)\n```", SKILL.read_text(), re.S)
    if not m:
        die("ARTIFACT B not found in hardware_compute.skill.md — has the skill been edited?")
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        die(f"ARTIFACT B is not valid JSON ({e}) — fix the skill file, not this script")


def dig(probe, dotted):
    cur = probe
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def compare(key, want, probe):
    """One threshold -> (ok, human explanation). null fails, per null_law."""
    if key.endswith("_min"):
        path, got = key[:-4], dig(probe, key[:-4])
        if got is None:
            return False, f"{path} unreadable (null) — null_law: an unverifiable gate is closed"
        return got >= want, f"{path}={got}, need >= {want}"
    if key.endswith("_max"):
        path, got = key[:-4], dig(probe, key[:-4])
        if got is None:
            return False, f"{path} unreadable (null) — null_law: an unverifiable gate is closed"
        return got <= want, f"{path}={got}, need <= {want}"
    if key.endswith("_in"):
        path, got = key[:-3], dig(probe, key[:-3])
        if got is None:
            return False, f"{path} unreadable (null) — null_law: an unverifiable gate is closed"
        return got in want, f"{path}={got!r}, need one of {want}"
    got = dig(probe, key)
    if want == "any":
        return True, f"{key}={got!r} (any accepted)"
    return got == want, f"{key}={got!r}, need {want!r}"


def check_thermal(spec, probe):
    """thermal_law: at least ONE reading must be readable, and every readable one passes."""
    results, readable = [], 0
    for key in THERMAL_KEYS:
        if key not in spec:
            continue
        if dig(probe, key[:-4] if key.endswith(("_min", "_max")) else key) is None:
            metric = key[:-4] if key.endswith(("_min", "_max")) else key
            results.append((True, f"{metric} unreadable — allowed, the paired reading is not"))
            continue
        readable += 1
        ok, why = compare(key, spec[key], probe)
        results.append((ok, why))
    if not any(k in spec for k in THERMAL_KEYS):
        return []
    if readable == 0:
        return [(False, "thermal_law: neither cpu_temp_c nor cpu_perf_pct is readable — "
                        "no way to verify the machine is not throttling, so the gate closes")]
    return results


def evaluate(cls, law, probe):
    spec = law["thresholds"].get(cls)
    if spec is None:
        die(f"unknown workload class {cls!r}; ARTIFACT B defines {list(law['thresholds'])}")

    checks = []

    # host_law — this system is ported to one laptop; anything else is a wrong route.
    kind = dig(probe, "host.kind")
    checks.append((kind in SUPPORTED_HOSTS,
                   f"host.kind={kind!r}, need one of {sorted(SUPPORTED_HOSTS)} (host_law)"))
    if dig(probe, "gpu.status") == "discrete":
        checks.append((False, "gpu.status=discrete — this system is ported to a machine with "
                              "integrated graphics; re-read DECISIONS.md § D8 (host_law)"))

    for key, want in spec.items():
        if key.startswith("_") or key in THERMAL_KEYS:
            continue
        checks.append(compare(key, want, probe))
    checks.extend(check_thermal(spec, probe))

    return checks


def single_flight(cls, now, force):
    """single_flight_law: one heavy job at a time on one machine."""
    if not TOKEN.exists():
        return None
    try:
        tok = json.loads(TOKEN.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    if tok.get("verdict") != "PASS":
        return None
    age = now - tok.get("ts_epoch", 0)
    if age >= tok.get("ttl_seconds", 1800):
        return None
    if tok.get("workload") == cls:
        return None          # refreshing our own token (continuous mode) is allowed
    if force:
        print(f"  WARNING: --force overrides a live token held by {tok.get('workload')}",
              file=sys.stderr)
        return None
    holder = tok.get("consumed_by") or "an unconsumed token"
    return (f"single_flight_law: {tok.get('workload')} holds a live token ({holder}, "
            f"{int(tok.get('ttl_seconds', 1800) - age)}s left). One heavy job at a time.")


def mint(cls, probe, passed, reasons, consume):
    now = int(time.time())
    if passed:
        tok = {
            "verdict": "PASS",
            "workload": cls,
            "ts_epoch": now,
            "ttl_seconds": 1800,
            "memory_budget_gb": dig(probe, "memory.dynamic_claim_limit_gb"),
            "probe_snapshot": {
                "gpu": dig(probe, "gpu.status"),
                "available_gb": dig(probe, "memory.available_gb"),
                "power": dig(probe, "power.source"),
                "cpu_perf_pct": dig(probe, "thermal.cpu_perf_pct"),
                "thermal_c": dig(probe, "thermal.cpu_temp_c"),
            },
            "consumed_by": consume,
            "law": "one token, one workload. The consuming skill writes its skill_id into "
                   "consumed_by; a consumed token cannot authorize a second job.",
        }
    else:
        tok = {"verdict": "DENY", "workload": cls, "ts_epoch": now, "reasons": reasons}
    TOKEN.parent.mkdir(parents=True, exist_ok=True)
    TOKEN.write_text(json.dumps(tok, indent=2) + "\n")
    return tok


def run_one(cls, law, probe, args, now):
    checks = evaluate(cls, law, probe)
    blocked = single_flight(cls, now, args.force) if not args.dry_run else None
    if blocked:
        checks.append((False, blocked))

    failures = [why for ok, why in checks if not ok]
    passed = not failures

    print(f"\n  {cls}  —  {'PASS' if passed else 'DENY'}")
    for ok, why in checks:
        print(f"    {'ok  ' if ok else 'FAIL'}  {why}")

    if not args.dry_run:
        tok = mint(cls, probe, passed, failures, args.consume)
        print(f"    token: {TOKEN.relative_to(ROOT)} -> {tok['verdict']}"
              + (f", budget {tok['memory_budget_gb']} GB" if passed else ""))
    if not passed:
        shown = set()
        lines = []
        for why in failures:
            for signature, key in REMEDY_FOR:
                if signature in why and key in law.get("remedies", {}) and key not in shown:
                    shown.add(key)
                    lines.append(f"      · {key}: {law['remedies'][key]}")
                    break
        if lines:
            print("\n    remedies:")
            print("\n".join(lines))
    return passed


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workload", nargs="?", help="workload class from ARTIFACT B")
    ap.add_argument("--all", action="store_true", help="evaluate every class")
    ap.add_argument("--probe", default=str(PROBE), help=f"probe JSON (default {PROBE})")
    ap.add_argument("--dry-run", action="store_true", help="evaluate without writing a token")
    ap.add_argument("--consume", metavar="SKILL_ID", help="stamp consumed_by on a minted token")
    ap.add_argument("--force", action="store_true",
                    help="override a live token held by another workload (single_flight_law)")
    args = ap.parse_args()

    if not args.workload and not args.all:
        ap.error("give a workload class, or --all")

    law = load_law()
    path = Path(args.probe)
    if not path.exists():
        die(f"no probe at {path} — run tools/bootstrap.sh, or "
            f"tools/hw/verify_compute.sh <class> > {path}")
    try:
        probe = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        die(f"probe JSON is malformed ({e})")

    age = int(time.time()) - probe.get("ts_epoch", 0)
    print(f"  probe: {path.name}, {age}s old, host={dig(probe, 'host.kind')}, "
          f"machine={dig(probe, 'host.machine')}")
    if age > 1800:
        print("  WARNING: probe is older than the 30-minute TTL — hardware truths go stale")

    now = int(time.time())
    classes = list(law["thresholds"]) if args.all else [args.workload]
    if args.all and not args.dry_run:
        die("--all writes one token per class, which single_flight_law forbids; "
            "use --all --dry-run to survey, then evaluate one class to mint")

    results = [run_one(c, law, probe, args, now) for c in classes]
    print()
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
