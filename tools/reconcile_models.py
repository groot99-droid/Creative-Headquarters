#!/usr/bin/env python3
"""
reconcile_models.py — check dashboard.json's model registry against what Ollama serves.

dashboard.json → hardware.local_llm.tiers ships PROVISIONAL tags. They describe the
shape of the registry, not an inventory of this machine. This compares them to
/api/tags and reports the drift; with --write it corrects the dashboard.

It will not pick a model for you silently. `local_rag_orchestration` P2b fails loudly on
a missing tag precisely so a wrong model never answers in place of the right one — a
reconciler that guessed would reintroduce exactly that failure.

    python3 tools/reconcile_models.py                    # report
    python3 tools/reconcile_models.py --write            # apply suggestions
    python3 tools/reconcile_models.py --endpoint http://172.24.0.1:11434

Exit 0 = registry matches what is served, 1 = drift, 2 = endpoint unreachable.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASH = ROOT / "dashboard.json"

# Tier ceilings come from hardware_compute ARTIFACT B: llm_local_sm is sized for <=8B at
# Q4, llm_local_md for 12-14B. A 70B model is not "the md tier but slower" on 16 GB —
# it does not load, so it is not a candidate for any tier.
TIER_RANGE = {"sm": (0, 8.9), "md": (9.0, 14.9)}


def endpoint_from_dashboard(d):
    return d["hardware"]["local_llm"]["endpoint"]


def wsl_gateway():
    """Under WSL2's default NAT, localhost is the VM. The Windows host is the gateway."""
    try:
        with open("/proc/version", encoding="utf-8") as f:
            if "microsoft" not in f.read().lower():
                return None
    except OSError:
        return None
    try:
        out = subprocess.run(["ip", "route", "show", "default"],
                             capture_output=True, text=True, timeout=5).stdout
        parts = out.split()
        return parts[2] if len(parts) > 2 else None
    except (OSError, subprocess.SubprocessError):
        return None


def fetch_tags(endpoint):
    try:
        with urllib.request.urlopen(f"{endpoint}/api/tags", timeout=6) as r:
            return json.loads(r.read().decode())["models"]
    except (urllib.error.URLError, OSError, ValueError, KeyError):
        return None


def params_b(model):
    """Parameter count in billions, from Ollama's details, or from the tag as a fallback."""
    size = (model.get("details") or {}).get("parameter_size") or ""
    m = re.match(r"([\d.]+)\s*B", str(size), re.I)
    if m:
        return float(m.group(1))
    m = re.search(r"[:\-](\d+(?:\.\d+)?)b\b", model.get("name", ""), re.I)
    return float(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--endpoint", help="override the dashboard's endpoint")
    ap.add_argument("--write", action="store_true", help="apply suggestions to dashboard.json")
    args = ap.parse_args()

    d = json.loads(DASH.read_text(encoding="utf-8"))
    llm = d["hardware"]["local_llm"]
    endpoint = args.endpoint or endpoint_from_dashboard(d)

    served = fetch_tags(endpoint)
    if served is None and not args.endpoint:
        gw = wsl_gateway()
        if gw:
            alt = re.sub(r"//[^:/]*", f"//{gw}", endpoint)
            served = fetch_tags(alt)
            if served is not None:
                print(f"  note: reachable at {alt}, not {endpoint} — from WSL, localhost is the VM")
                endpoint = alt
    if served is None:
        print(f"  Ollama not reachable at {endpoint}", file=sys.stderr)
        return 2

    names = [m["name"] for m in served]
    print(f"  {endpoint} serves {len(names)} model(s): {', '.join(names) or '(none)'}")

    drift, changes = False, {}
    for tier, spec in llm["tiers"].items():
        want = spec["model"]
        family = want.split(":")[0]
        exact = want in names
        same_family = [n for n in names if n.split(":")[0] == family]

        if exact:
            print(f"  ok    tier {tier}: {want} is served")
            continue
        if same_family:
            print(f"  drift tier {tier}: {want} not served, but {same_family[0]} is "
                  f"(P2b matches on family, so this already works)")
            continue

        drift = True
        lo, hi = TIER_RANGE[tier]
        cands = [m["name"] for m in served
                 if params_b(m) is not None and lo <= params_b(m) <= hi]
        if cands:
            print(f"  DRIFT tier {tier}: {want} is NOT served. Candidates in range "
                  f"{lo}-{hi}B: {', '.join(cands)}")
            changes[tier] = cands[0]
        else:
            print(f"  DRIFT tier {tier}: {want} is NOT served, and nothing in range "
                  f"{lo}-{hi}B is installed. Run: ollama pull {want}")

    embed = llm.get("embed_model")
    if embed and not any(n.split(":")[0] == embed.split(":")[0] for n in names):
        drift = True
        print(f"  DRIFT embed_model {embed} is NOT served. Run: ollama pull {embed}")

    if changes and args.write:
        for tier, pick in changes.items():
            llm["tiers"][tier]["model"] = pick
            print(f"  wrote tier {tier} -> {pick}")
        # Replace the note rather than splicing the provisional one: half of it was an
        # instruction to do what has now been done, and leaving that in reads as a
        # contradiction to the next person who opens the file.
        llm["_tiers_note"] = (
            "RECONCILED against the models Ollama actually serves, by "
            "tools/reconcile_models.py. local_rag_orchestration §1 P2b re-verifies the tag "
            "before any call and fails loudly rather than silently substituting a model, so "
            "re-run this after any `ollama pull` or `ollama rm`."
        )
        DASH.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("  dashboard.json updated — re-run tools/verify_system.py")
    elif changes:
        print("  re-run with --write to apply, or pull the declared tags instead")

    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
