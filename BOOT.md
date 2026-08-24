# First boot

Getting Studio Headless OS running on the studio laptop — a Lenovo Yoga Book 9i, 16 GB
soldered, Intel integrated graphics, driven from Claude Code desktop on Windows.

Everything here is idempotent. Run it again whenever the environment changes.

```bash
bash tools/bootstrap.sh          # preflight, extract probe, report what can run
python3 tools/verify_system.py   # protocol integrity — must exit 0
```

If both are clean, the hardware layer is live. The routing layer needs one more thing —
see **[Why it still says BLOCKED](#why-it-still-says-blocked)**, which is the part most
likely to look like a bug and is not one.

---

## 0. Which shell

Claude Code desktop may hand a bash block to **Git Bash** or to **WSL2**. Both are
supported and `bootstrap.sh` detects which it is in. Pick one and stay in it — they
disagree about this machine in ways that matter:

| | Git Bash (`windows`) | WSL2 (`wsl`) |
|---|---|---|
| memory readings | direct via PowerShell | **`/proc/meminfo` describes the WSL VM, not the laptop** — the probe refuses it and reads through PowerShell instead |
| `localhost:11434` | reaches Ollama | reaches the **WSL VM**, not Windows — needs the gateway address |
| Adobe temp files | native paths | must be written to the Windows temp dir; Photoshop cannot open a WSL path |

Git Bash is the simpler of the two here. WSL2 works, and every place it differs is
handled, but it is the configuration where a wrong answer looks plausible.

---

## 1. Prerequisites

**Required** — `bootstrap.sh` fails without these:

- **Python 3** on PATH (`python3 --version`). Git Bash users: install from python.org and
  make sure it is `python3`, not only `py`.
- **PowerShell** reachable as `powershell.exe`. Present on any Windows install; from WSL
  it must be on PATH (it is by default).
- `curl`, `awk`, `df`, `grep` — all present in Git Bash and WSL.

**Optional** — each unlocks specific routes, and `bootstrap.sh` reports which are missing
rather than failing:

| What | Unlocks | Install note |
|---|---|---|
| **Ollama** | `local_rag_orchestration` | Windows installer from ollama.com. See § 2. |
| **Photoshop / Illustrator / After Effects** | `adobe_suite_uxp` | Bridged over COM; no plugin needed. Premiere has no COM automation and is not driveable. |
| **Blender 4+** | `blender_python` | Default install path is detected; otherwise `export BLENDER_BIN=/c/path/to/blender.exe`. |

---

## 2. Ollama

```powershell
ollama pull llama3.1:8b        # or whatever 8B-class model you prefer
ollama pull nomic-embed-text   # embeddings for the vault index
```

Then reconcile the registry with what you actually installed:

```bash
python3 tools/reconcile_models.py            # report drift
python3 tools/reconcile_models.py --write    # apply it
```

`dashboard.json → hardware.local_llm.tiers` ships **provisional** tags. They are the
shape of the registry, not an inventory of your machine. The reconciler will not pick a
model silently — `local_rag_orchestration` P2b fails loudly on a missing tag so that a
wrong model never answers in place of the right one, and a guessing reconciler would
reintroduce exactly that.

**Tier sizes are not preferences.** `sm` is ≤8B at Q4 with an 8k context; `md` is 12–14B
at 4k and requires AC power and a quiet desktop. On 16 GB shared with Windows, `num_ctx`
is a memory decision before it is a quality one — Ollama allocates the KV cache at load,
so a bigger window costs gigabytes you will want for Photoshop.

### If you are in WSL2

Ollama runs on the Windows side. Under WSL2's default NAT networking, `localhost` inside
WSL is the VM, so the endpoint has to be the Windows host:

```powershell
# Windows, once: bind Ollama to all interfaces and let WSL through the firewall
setx OLLAMA_HOST "0.0.0.0"
New-NetFirewallRule -DisplayName "Ollama from WSL" -Direction Inbound `
  -LocalPort 11434 -Protocol TCP -Action Allow
```

Restart Ollama. `bootstrap.sh`, `reconcile_models.py` and the skill's P2a step all detect
this and retarget to the gateway automatically; the firewall rule is the part they cannot
do for you.

---

## 3. What bootstrap does

1. Identifies the shell, and refuses macOS outright (DECISIONS.md § D8).
2. Checks prerequisites, hard and soft, and says which is which.
3. Extracts the probe from `hardware_compute` **ARTIFACT A** into
   `tools/hw/verify_compute.sh`. That file is generated and gitignored — if the probe
   needs fixing, fix the skill file and re-run bootstrap. `verify_system.py` fails if the
   extracted copy drifts from its source.
4. Runs the probe into `state/hw_probe_latest.json`.
5. Evaluates every workload class against **ARTIFACT B** and prints what would pass.

Nothing outside `state/` and `tools/hw/` is touched, and no gate token is minted.

---

## 4. Using the gate

```bash
python3 tools/hw/evaluate_gate.py --all --dry-run        # what could run right now
python3 tools/hw/evaluate_gate.py llm_local_sm           # mint a token for one job
python3 tools/hw/evaluate_gate.py render_3d_cpu --consume blender_python
```

A `PASS` writes `state/compute_gate.json` with a 30-minute TTL and a memory budget. The
consuming skill stamps `consumed_by`; a consumed token cannot authorize a second job.

Three denials will look surprising the first time, and all three are correct:

- **On battery.** Windows caps sustained clocks on battery, so every class except
  `llm_local_sm` requires AC.
- **Thermal unreadable.** `MSAcpi_ThermalZoneTemperature` is often access-denied on
  consumer laptops. The gate accepts *either* temperature or processor-performance
  percentage — but if neither is readable it closes, because an unverifiable gate is a
  closed gate. Check the PowerShell bridge first.
- **Another job holds the token.** One heavy job at a time. If a job died without
  consuming its token, delete `state/compute_gate.json` and re-probe.

Thresholds live in ARTIFACT B in the skill file, not in the evaluator. Edit them there
and `tools/hw/test_gate.py` will tell you what you changed.

---

## Why it still says BLOCKED

After a clean bootstrap, `verify_system.py` passes and `dashboard.json` still declares
`system_status.state: BLOCKED`. That is the protocol working, not a failure.

`Router.md` §3 names ten **brand gates** — `visual_identity`, `color_science`,
`render_philosophy` and seven more — that every route must resolve before executing. None
is authored. §5's ladder then tries to resolve them from the vault: from a prior decision
recorded in a Content MD (L1), or from precedent across several notes (L2). With nothing
authored and no notes, every constant lands at **L3 — unresolved**, and L3 parks the task
with a written reason instead of guessing.

The system refuses to invent your palette. That is the whole design.

**To unblock it, do either:**

- **Author a brand gate.** Write `context/brand/<name>.context.md` — see
  `context/brand/README.md` for what each of the ten must answer — then flip that gate's
  `authored` flag in `dashboard.json`. `verify_system.py` checks the flag against what is
  actually on disk, so it will catch a claim that is not true. One authored file promotes
  that constant to L0: exact, permanent, no inference.
- **Write a Content MD into `vault/`.** See `vault/SCHEMA.md` and
  `vault/_templates/content-md.md`. Notes accumulate the answers as a side effect of
  working, and the ladder starts recalling them.

Neither can be generated for you. They encode taste and prior decisions — the two things
the Router exists to keep out of the model's hands.

---

## Known unknowns

The Windows and WSL branches of the probe — every PowerShell query, the WSL gateway
rewrite, the `wslpath` handoff to Photoshop — have been syntax-checked and exercised on
Linux, but **have never run on the target laptop**. Treat first boot as debugging, not as
a smoke test. When something reads wrong, the probe is one file
(`tools/hw/verify_compute.sh`, generated from ARTIFACT A) and it emits plain JSON:

```bash
./tools/hw/verify_compute.sh generic | python3 -m json.tool
```

Fix the skill's ARTIFACT A, re-run `bash tools/bootstrap.sh --probe`, and the drift check
will keep the two honest.
