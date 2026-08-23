#!/usr/bin/env python3
"""
verify_system.py — Studio Headless OS protocol integrity checker.

The failure this exists to prevent: Router.md, dashboard.json, router.js and the
eight skill headers each carry a copy of the routing contract. When those copies
drift, the Router halts on every task (§7) or, worse, routes with context that
was never loaded. Run this after touching any protocol file.

    python3 tools/verify_system.py          # human output
    python3 tools/verify_system.py --quiet  # exit code only

Exit 0 = consistent, 1 = at least one FAIL.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILS: list[str] = []
WARNS: list[str] = []
OKS: list[str] = []


def ok(msg):   OKS.append(msg)
def fail(msg): FAILS.append(msg)
def warn(msg): WARNS.append(msg)


def load_dashboard():
    try:
        return json.loads((ROOT / "dashboard.json").read_text())
    except Exception as e:
        fail(f"dashboard.json does not parse: {e}")
        return None


def check_protocol_files(d):
    """The 22 protocol files must all exist, and the declared count must be honest."""
    core = ["Router.md", "dashboard.json", "control_room.html", "router.js"]
    skills = sorted(p.name for p in ROOT.glob("*.skill.md"))
    contexts = sorted(p.name for p in ROOT.glob("*_context.md"))

    missing = [f for f in core if not (ROOT / f).exists()]
    if missing:
        fail(f"missing core file(s): {', '.join(missing)}")
    else:
        ok("4 core protocol files present")

    ok(f"{len(skills)} skill files, {len(contexts)} context files on disk")

    total = len(core) + len(skills) + len(contexts)
    declared = d["meta"].get("protocol_file_count")
    if declared != total:
        fail(f"meta.protocol_file_count={declared} but {total} protocol files exist")
    else:
        ok(f"protocol file count matches declaration ({total})")
    return skills, contexts


def check_skill_registry(d, skills_on_disk):
    registered = [s["file"] for s in d["registries"]["skills"]]
    for f in registered:
        if not (ROOT / f).exists():
            fail(f"registries.skills lists {f}, which is not on disk (Router §7 refusal)")
    for f in skills_on_disk:
        if f not in registered:
            fail(f"{f} is on disk but absent from registries.skills — the Router will refuse it")
    if not FAILS:
        ok(f"all {len(registered)} registered skills exist and are registered")


def check_context_bindings(d, contexts_on_disk):
    """Every role resolves to real files; every context file is reachable."""
    roles = d["registries"]["context_roles"]

    bad = [(r, f) for r, files in roles.items() for f in files if not (ROOT / f).exists()]
    for role, f in bad:
        fail(f"role '{role}' binds to {f}, which does not exist")
    if not bad:
        ok(f"all {len(roles)} context roles resolve to files that exist")

    bound = {f for files in roles.values() for f in files}
    unreachable = sorted(set(contexts_on_disk) - bound)
    for f in unreachable:
        warn(f"{f} is not reachable through any role — dead corpus weight")
    if not unreachable:
        ok(f"all {len(contexts_on_disk)} context files reachable through a role")

    # registries.context_files must agree with the role map
    declared = {c["file"]: set(c.get("roles", [])) for c in d["registries"]["context_files"]}
    derived: dict[str, set] = {}
    for role, files in roles.items():
        for f in files:
            derived.setdefault(f, set()).add(role)
    if declared != derived:
        for f in sorted(set(declared) | set(derived)):
            if declared.get(f, set()) != derived.get(f, set()):
                fail(f"context_files[{f}].roles={sorted(declared.get(f, []))} "
                     f"but context_roles implies {sorted(derived.get(f, []))}")
    else:
        ok("registries.context_files agrees with registries.context_roles")

    return roles


def check_skill_headers(d, roles):
    """Each skill's mandatory_context must name roles that exist in the binding map."""
    for path in sorted(ROOT.glob("*.skill.md")):
        m = re.search(r"^mandatory_context:\s*\[(.*?)\]", path.read_text(), re.M)
        if not m:
            fail(f"{path.name} has no mandatory_context in its routing header")
            continue
        declared = [r.strip() for r in m.group(1).split(",") if r.strip()]
        unbound = [r for r in declared if r not in roles]
        for r in unbound:
            fail(f"{path.name} requires role '{r}', which has no binding (route would be BLOCKED)")
    if not any("mandatory_context" in f or "requires role" in f for f in FAILS):
        ok("every skill's mandatory_context resolves through the binding map")


def check_router_md(d, roles):
    """Router.md §3.1 is a mirror of the dashboard map; mirrors go stale."""
    text = (ROOT / "Router.md").read_text()
    for role in roles:
        if f"`{role}`" not in text:
            warn(f"role '{role}' is bound in dashboard.json but never mentioned in Router.md")
    # Look for /skills/ and /context/ used as real path CLAIMS. The topology
    # section names them to deny they exist, so unwrap the prose first and
    # discount the sentence that does the denying.
    flat = " ".join(text.split())
    denial = ("There is no `/skills/` or `/context/` directory")
    claims = flat.replace(denial, "")
    for legacy in ("/skills/", "/context/"):
        if legacy in claims:
            fail(f"Router.md still refers to {legacy} as a real path; the repository is flat")
    if denial not in flat:
        warn("Router.md no longer states the layout is flat — re-check §1 before trusting this")
    ok("Router.md topology matches the flat repository layout")


def check_router_js(d, roles):
    """router.js must not carry a second, divergent copy of the binding map."""
    text = (ROOT / "router.js").read_text()
    if "STATE?.registries?.context_roles" not in text:
        fail("router.js does not read the binding map from dashboard.json — it will drift")
    else:
        ok("router.js resolves context through dashboard.json at runtime")

    for role in roles:
        if role not in text:
            warn(f"role '{role}' missing from router.js cold-start fallback")

    # every CSS class router.js emits must exist in the stylesheet
    css = (ROOT / "control_room.html").read_text()
    for cls in sorted(set(re.findall(r'"(c-[a-z]+)"', text))):
        if f".{cls}" not in css:
            fail(f"router.js emits .{cls} but control_room.html defines no such class")
    ok("every status class router.js emits is defined in control_room.html")

    # every element id router.js writes to must exist in the markup
    for eid in sorted(set(re.findall(r'\$\("([a-z0-9-]+)"\)', text))):
        if f'id="{eid}"' not in css:
            fail(f'router.js writes to #{eid}, which does not exist in control_room.html')
    ok("every element id router.js targets exists in control_room.html")


def check_palette_parity(d):
    """css_html_ui P3: control_room.html tokens must mirror the dashboard palette."""
    palette = [c.upper() for c in d["active_variables"]["master_palette"]]
    css = (ROOT / "control_room.html").read_text()
    tokens = dict(re.findall(r"--([a-z-]+):\s*(#[0-9A-Fa-f]{6})", css))
    core = [tokens.get(k, "").upper() for k in ("bg", "amber", "cyan", "alert", "ink")]
    if core != palette:
        fail(f"token/palette drift: control_room.html {core} != master_palette {palette}")
    else:
        ok("control_room.html tokens mirror active_variables.master_palette")


def check_pipeline(d):
    """Phase skills must be real skills; progress must agree with status."""
    registered = {s["file"].replace(".skill.md", "") for s in d["registries"]["skills"]}
    enum = set(d["pipeline"]["status_enum"])
    ids = [p["id"] for p in d["pipeline"]["phases"]]

    if len(ids) != len(set(ids)):
        fail("duplicate phase ids in pipeline.phases")
    if d["pipeline"]["current_phase_id"] not in ids:
        fail(f"current_phase_id={d['pipeline']['current_phase_id']} is not a real phase")

    for p in d["pipeline"]["phases"]:
        if p["skill"] not in registered:
            fail(f"phase {p['id']} routes to unregistered skill '{p['skill']}'")
        if p["status"] not in enum:
            fail(f"phase {p['id']} has status '{p['status']}' outside status_enum")
        pct = p["progress_pct"]
        if not 0 <= pct <= 100:
            fail(f"phase {p['id']} progress_pct={pct} out of range")
        if p["status"] == "complete" and pct != 100:
            fail(f"phase {p['id']} is complete but progress_pct={pct}")
        if p["status"] == "queued" and pct != 0:
            fail(f"phase {p['id']} is queued but progress_pct={pct}")
    ok(f"all {len(ids)} pipeline phases route to registered skills with coherent progress")


def check_context_loaded(d, roles):
    for r in d["system_status"].get("context_loaded", []):
        if r not in roles:
            fail(f"system_status.context_loaded names '{r}', which has no binding")
    ok("system_status.context_loaded names only bound roles")


def check_event_log(d):
    log = d["event_log"]
    ts = [e["ts"] for e in log]
    if ts != sorted(ts, reverse=True):
        fail("event_log is not newest-first; renderLog and LOG_LIMIT assume it is")
    for e in log:
        missing = [k for k in ("ts", "actor", "event", "detail") if k not in e]
        if missing:
            fail(f"event_log entry missing {missing}")
    ok(f"event_log is newest-first and well-formed ({len(log)} entries)")


def main():
    quiet = "--quiet" in sys.argv
    d = load_dashboard()
    if d is None:
        print("FAIL  dashboard.json does not parse — nothing else can be checked")
        return 1

    skills, contexts = check_protocol_files(d)
    check_skill_registry(d, skills)
    roles = check_context_bindings(d, contexts)
    check_skill_headers(d, roles)
    check_router_md(d, roles)
    check_router_js(d, roles)
    check_palette_parity(d)
    check_pipeline(d)
    check_context_loaded(d, roles)
    check_event_log(d)

    if not quiet:
        print("\n  STUDIO HEADLESS OS — PROTOCOL INTEGRITY\n")
        for m in OKS:   print(f"  \033[92mPASS\033[0m  {m}")
        for m in WARNS: print(f"  \033[93mWARN\033[0m  {m}")
        for m in FAILS: print(f"  \033[91mFAIL\033[0m  {m}")
        print(f"\n  {len(OKS)} passed · {len(WARNS)} warnings · {len(FAILS)} failures\n")

    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
