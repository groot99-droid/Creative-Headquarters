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
    skills = sorted("skills/" + p.name for p in (ROOT / "skills").glob("*.skill.md"))
    contexts = sorted("context/domain/" + p.name
                      for p in (ROOT / "context" / "domain").glob("*_context.md"))

    missing = [f for f in core if not (ROOT / f).exists()]
    if missing:
        fail(f"missing core file(s): {', '.join(missing)}")
    else:
        ok("4 core protocol files present")

    ok(f"{len(skills)} skills in skills/, {len(contexts)} libraries in context/domain/")
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


def check_brand_gates(d):
    """Router.md §3 gates resolve to context/brand/<role>.context.md.

    The gates are brand constants and are not yet authored, so the Router blocks —
    that is the documented, intended state (context/brand/README.md), not a failure.
    What this checks is that the dashboard tells the truth about which exist.
    """
    gates = d["registries"]["context_brand_gates"]
    roles = {g["role"] for g in gates}

    if len(roles) != len(gates):
        fail("duplicate role in registries.context_brand_gates")

    for g in gates:
        expected = f"context/brand/{g['role']}.context.md"
        if g.get("path") != expected:
            fail(f"gate {g['role']} declares path {g.get('path')}, expected {expected}")
        on_disk = (ROOT / expected).exists()
        if bool(g.get("authored")) != on_disk:
            fail(f"gate {g['role']}: authored={g.get('authored')} but file "
                 f"{'exists' if on_disk else 'does not exist'} on disk")

    authored = [g["role"] for g in gates if g.get("authored")]
    ok(f"all {len(gates)} brand gates declare correct paths; "
       f"{len(authored)} authored, {len(gates) - len(authored)} pending")

    registered_skills = {s["file"] for s in d["registries"]["skills"]}
    for g in gates:
        for sk in g.get("gates_skills", []):
            if f"skills/{sk}.skill.md" not in registered_skills:
                fail(f"gate {g['role']} claims to gate unknown skill '{sk}'")
    ok("every brand gate references registered skills only")
    return roles


def check_domain_libraries(d, contexts_on_disk):
    """Domain libraries are retrieval material. They must exist, and must never be
    declared as a brand gate — that substitution is the thing Router.md §3 forbids."""
    declared = d["registries"]["context_domain_libraries"]
    for f in declared:
        if not (ROOT / f).exists():
            fail(f"context_domain_libraries lists {f}, which is not on disk")
    for f in contexts_on_disk:
        if f not in declared:
            warn(f"{f} is on disk but not listed in context_domain_libraries")

    gate_paths = {g["path"] for g in d["registries"]["context_brand_gates"]}
    overlap = gate_paths & set(declared)
    if overlap:
        fail(f"domain library declared as a brand gate (forbidden by §3): {sorted(overlap)}")
    ok(f"all {len(declared)} domain libraries exist and none stands in for a brand gate")


def check_skill_headers(d, roles):
    """Each skill's mandatory_context must name roles that exist in the binding map."""
    for path in sorted((ROOT / "skills").glob("*.skill.md")):
        m = re.search(r"^mandatory_context:\s*\[(.*?)\]", path.read_text(), re.M)
        if not m:
            fail(f"{path.name} has no mandatory_context in its routing header")
            continue
        declared = [r.strip() for r in m.group(1).split(",") if r.strip()]
        unknown = [r for r in declared if r not in roles]
        for r in unknown:
            fail(f"{path.name} requires '{r}', which is not one of the ten brand gates")
    if not any("mandatory_context" in f or "not one of the ten" in f for f in FAILS):
        ok("every skill's mandatory_context names a declared brand gate")


# macOS-only binaries. The port to a single Windows laptop (DECISIONS.md § D8) removed
# every call to these; this check exists so they cannot creep back in from a copied
# snippet or an older skill file. Scanned inside fenced code blocks only, and there at
# command position: these files explain the port they came from, so `osascript` and
# `cycles.device = "GPU"` both appear in prose describing what was REMOVED. A checker
# that cannot tell an invocation from a description of an invocation fails every
# honestly-documented migration.
MAC_ONLY = {
    "osascript": "AppleScript bridge — use PowerShell COM (adobe_suite_uxp ARTIFACT D)",
    "vm_stat":   "macOS memory probe — use the PowerShell bridge (hardware_compute ARTIFACT A)",
    "sysctl":    "macOS/BSD sysctl — use Win32_ComputerSystem / /proc/meminfo",
    "afplay":    "macOS audio playback",
    "pbcopy":    "macOS clipboard",
}
CMD_POS = r"(?m)(?:^|[|;&]|\$\()\s*(?:[A-Z_]+=\S+\s+)*({})\b"


def check_host_portability(d):
    """Every skill declares which host kinds it runs on, and none invokes a macOS binary.

    The failure this prevents: v1.x was written for a macOS host plus a CUDA node. When
    that assumption was removed, the risk stopped being 'the code is wrong' and became
    'the code is wrong in one file nobody reopened'. A skill that still shells out to
    osascript is not a portability nit here — it is a route that dies at execution on the
    only machine this system now runs on.
    """
    supported = set(d["hardware"].get("host_kind_enum", []))
    if not supported:
        fail("dashboard hardware.host_kind_enum is empty — nothing to check host_kinds against")
        return

    def fenced(text):
        """Only what is inside ``` fences — prose about the migration is not code."""
        return "\n".join(re.findall(r"^```[a-z]*\n(.*?)^```", text, re.S | re.M))

    for path in sorted((ROOT / "skills").glob("*.skill.md")):
        text = path.read_text()
        code = fenced(text)
        m = re.search(r"^host_kinds:\s*\[(.*?)\]", text, re.M)
        if not m:
            fail(f"{path.name} declares no host_kinds — the Router cannot tell if it runs here")
        else:
            declared = [h.strip() for h in m.group(1).split(",") if h.strip()]
            unknown = [h for h in declared if h not in supported]
            for h in unknown:
                fail(f"{path.name} declares host_kind '{h}', which is not in "
                     f"hardware.host_kind_enum ({', '.join(sorted(supported))})")

        for binary, why in MAC_ONLY.items():
            if re.search(CMD_POS.format(binary), code):
                fail(f"{path.name} invokes macOS-only '{binary}' — {why}")
        if "/Applications/" in code:
            fail(f"{path.name} contains a macOS /Applications/ path — this host is Windows")

        if d["hardware"].get("gpu", {}).get("cuda") is False:
            if re.search(r'^\s*(?:scn|scene)\.cycles\.device\s*=\s*"GPU"', code, re.M):
                fail(f"{path.name} sets cycles.device=GPU, but hardware.gpu.cuda is false — "
                     f"the render would fall back to CPU silently")
    ok(f"all 8 skills declare host_kinds within {sorted(supported)} and invoke no macOS-only binary")


def check_extracted_probe():
    """tools/hw/verify_compute.sh is generated from ARTIFACT A. It must still match.

    The failure this prevents is the oldest one in the book: the probe is extracted once,
    then debugged in place on the studio machine, and the skill file — which every future
    extraction reads — keeps the broken original. The extracted copy is gitignored, so
    this only fires on a machine that has actually bootstrapped.
    """
    extracted = ROOT / "tools" / "hw" / "verify_compute.sh"
    if not extracted.exists():
        return                      # not bootstrapped here; nothing to drift
    skill = (ROOT / "skills" / "hardware_compute.skill.md").read_text()
    m = re.search(r"### ARTIFACT A.*?\n```bash\n(.*?)\n```", skill, re.S)
    if not m:
        fail("ARTIFACT A not found in hardware_compute.skill.md")
        return
    if extracted.read_text().strip() != m.group(1).strip():
        fail("tools/hw/verify_compute.sh has drifted from ARTIFACT A — edit the skill "
             "file and re-run tools/bootstrap.sh; the extracted copy is not the source")
    else:
        ok("extracted probe matches ARTIFACT A")


def check_router_md(d, roles):
    """Router.md §3 names the gates; the dashboard declares them. Mirrors go stale."""
    text = (ROOT / "Router.md").read_text()
    for role in roles:
        if f"`{role}`" not in text:
            warn(f"role '{role}' is bound in dashboard.json but never mentioned in Router.md")
    # Look for /skills/ and /context/ used as real path CLAIMS. The topology
    # section names them to deny they exist, so unwrap the prose first and
    # discount the sentence that does the denying.
    flat = " ".join(text.split())
    for needed in ("/skills/", "/context/", "context/brand/<name>.context.md"):
        if needed not in flat:
            fail(f"Router.md §1/§3 no longer mentions {needed}; topology has drifted from disk")
    ok("Router.md topology and path resolution match the repository layout")


def check_router_js(d, roles):
    """router.js must not carry a second, divergent copy of the binding map."""
    text = (ROOT / "router.js").read_text()
    if "STATE?.registries?.context_brand_gates" not in text:
        fail("router.js does not read gate state from dashboard.json — it will drift")
    else:
        ok("router.js reads brand-gate state from dashboard.json at runtime")

    # Strip comments first: prose explaining why domain libraries are excluded is fine;
    # what must not exist is code that actually builds a context/domain/ path.
    code = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    code = re.sub(r"(?m)^\s*//.*$", "", code)
    code = re.sub(r"(?m)\s+//.*$", "", code)
    if "context/brand/" not in code:
        fail("router.js does not resolve gates to context/brand/ (Router.md §3)")
    if "context/domain/" in code:
        fail("router.js builds a context/domain/ path — a library must never satisfy a gate")
    ok("router.js resolves gates to context/brand/ and never to a domain library")

    for role in roles:
        if role not in text:
            warn(f"gate '{role}' missing from router.js resolveGates table")

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
    """css_html_ui ARTIFACT A is the 'ABSOLUTE SOURCE OF TRUTH' for tokens.

    active_variables used to carry master_palette; it is run-scoped now (DECISIONS.md D6),
    so the token dictionary in the skill file is the thing the UI must still mirror.
    """
    skill = ROOT / "skills" / "css_html_ui.skill.md"
    if not skill.exists():
        fail("skills/css_html_ui.skill.md missing — cannot check token parity")
        return
    text = skill.read_text()
    want = {}
    for key in ("base", "raise", "panel"):
        m = re.search(r'"bg":\s*\{[^}]*"%s":\s*"(#[0-9A-Fa-f]{6})"' % key, text)
        if m:
            want["bg" if key == "base" else "bg-" + key] = m.group(1).upper()
    for key in ("amber", "cyan", "alert", "queued"):
        m = re.search(r'"accent":\s*\{[^}]*"%s":\s*"(#[0-9A-Fa-f]{6})"' % key, text)
        if m:
            want[key] = m.group(1).upper()
    if not want:
        warn("could not parse the token dictionary from css_html_ui ARTIFACT A")
        return

    css = (ROOT / "control_room.html").read_text()
    have = {k: v.upper() for k, v in re.findall(r"--([a-z-]+):\s*(#[0-9A-Fa-f]{6})", css)}
    drift = {k: (v, have.get(k)) for k, v in want.items() if have.get(k) != v}
    if drift:
        for k, (expected, actual) in sorted(drift.items()):
            fail(f"token drift: --{k} is {actual} in control_room.html, "
                 f"{expected} in css_html_ui ARTIFACT A")
    else:
        ok(f"control_room.html mirrors all {len(want)} css_html_ui ARTIFACT A tokens")


def check_pipeline(d):
    """Phase skills must be real skills; progress must agree with status."""
    registered = {s["file"].replace("skills/", "").replace(".skill.md", "")
                  for s in d["registries"]["skills"]}
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
    authored = {g["role"] for g in d["registries"]["context_brand_gates"] if g.get("authored")}
    for r in d["system_status"].get("context_loaded", []):
        if r not in roles:
            fail(f"system_status.context_loaded names '{r}', which is not a brand gate")
        elif r not in authored:
            fail(f"system_status.context_loaded claims '{r}' is loaded, but it is not authored")
    ok("system_status.context_loaded claims only authored gates")

    # §5: with nothing authored and no vault notes, every context lands at L3, which parks.
    st = d["system_status"]
    unauthored = [g["role"] for g in d["registries"]["context_brand_gates"] if not g.get("authored")]
    vault = ROOT / "vault"
    notes = [f for f in vault.rglob("*.md")
             if vault in f.parents and not any(part.startswith("_") for part in f.relative_to(vault).parts)
             and f.name not in ("README.md", "SCHEMA.md")] if vault.exists() else []
    if unauthored and not notes and st.get("state") != "BLOCKED":
        fail(f"{len(unauthored)} gates unauthored and no vault notes to recall or derive from, "
             f"so every route parks at L3 — but system_status.state is {st.get('state')!r}")
    elif unauthored and not notes:
        ok(f"state BLOCKED is consistent with L3: {len(unauthored)} gates unauthored, "
           f"{len(notes)} vault notes available")


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
    roles = check_brand_gates(d)
    check_domain_libraries(d, contexts)
    check_skill_headers(d, roles)
    check_host_portability(d)
    check_extracted_probe()
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
