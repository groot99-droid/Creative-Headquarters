# hardware_compute.skill.md — COMPUTE VERIFICATION & ALLOCATION GATE
### Studio Headless OS · Skill 8/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: hardware_compute
version: 2.0
trigger_a: ["render locally", "GPU", "heavy compute", "batch process", "out of memory", "thermals", "on battery"]
trigger_b: ["ANY task where another skill declares danger_class: LOCAL_COMPUTE_HEAVY"]
mandatory_context: [pipeline_ethics, render_philosophy]
host_kinds: [windows, wsl, linux]
version_note: v2.0 — single-host port. One laptop (Lenovo Yoga Book 9i, 16 GB shared, Intel iGPU), three shells (Windows/Git Bash, WSL2, Linux). Replaces the v1.x macOS-host + CUDA-node split.
writes_dashboard_keys: [hardware.*, system_status.state]
danger_class: GATEKEEPER   # this skill blocks other skills; it never launches compute itself
gate_token_path: state/compute_gate.json
gate_ttl_seconds: 1800
```

This skill is the **hardware bouncer**. Compute-heavy skills (`blender_python`,
`local_rag_orchestration`, batch `adobe_suite_uxp`) may not run unless a fresh `PASS`
token exists at `state/compute_gate.json`. The token expires in 30 minutes — hardware
truths go stale.

**What changed in v2.0, and why it is not cosmetic.** The studio used to be two
machines: a 192 GB Mac host and a CUDA node that absorbed every render. It is now one
14″ laptop with 16 GB of soldered memory shared between the CPU, the integrated GPU,
two OLED panels, Windows, and whatever Adobe has open. Three consequences drive this
file:

1. **There is no elsewhere.** Jobs that used to run on different machines now contend
   for the same 16 GB. The gate enforces **single-flight** (§2.4): an unconsumed,
   unexpired token for one workload blocks minting a token for another.
2. **Thermals and power became first-class.** A thin passive-leaning chassis throttles
   under sustained load, and Windows throttles harder still on battery. `power.source`
   is a gate, not a footnote.
3. **The old thresholds were written for 192 GB.** `llm_671b` wanted 140 GB available.
   Nothing on this machine can pass a threshold like that, and softening them one at a
   time would have produced a gate that passes everything. The workload classes are
   re-cut to what this laptop can actually hold (ARTIFACT B).

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Identify which SHELL we are in. The studio is ONE machine, but Claude Code
#      desktop may hand a bash block to Git Bash (MSYS), to WSL2, or to a native
#      Linux install. Those three see different truths about the same laptop —
#      see the WSL law in P4 for the one that bites.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) STUDIO_HOST_KIND=windows ;;
  Linux)
    if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
      STUDIO_HOST_KIND=wsl
    else
      STUDIO_HOST_KIND=linux
    fi ;;
  Darwin) STUDIO_HOST_KIND=macos ;;   # recognized only to refuse it: see host_law
  *)      STUDIO_HOST_KIND=unknown ;;
esac
export STUDIO_HOST_KIND
case "$STUDIO_HOST_KIND" in
  windows|wsl|linux) echo "OK:P2 ($STUDIO_HOST_KIND)" ;;
  *) echo "FAIL:P2 unsupported host kind: $STUDIO_HOST_KIND" ;;
esac

# P3 — Tools available for THIS shell (never require nvidia-smi: there is no CUDA here)
case "$STUDIO_HOST_KIND" in
  windows|wsl) REQ="awk df grep" ;;
  linux)       REQ="awk df grep" ;;
esac
for t in $REQ; do
  command -v "$t" >/dev/null 2>&1 || echo "FAIL:P3 missing $t"
done; echo "OK:P3"

# P4 — WSL LAW: inside WSL2, /proc/meminfo describes the WSL virtual machine, not the
#      laptop. Its default allocation is a fraction of host RAM and it balloons, so it
#      lies in both directions. From WSL the probe MUST read memory through the
#      PowerShell bridge; if the bridge is missing, memory is null and the gate closes.
if [ "$STUDIO_HOST_KIND" = wsl ]; then
  command -v powershell.exe >/dev/null 2>&1 || command -v pwsh.exe >/dev/null 2>&1 \
    && echo "OK:P4 windows bridge reachable" \
    || echo "FAIL:P4 no powershell.exe on PATH — WSL cannot see the laptop's real memory"
else
  echo "OK:P4 (not WSL)"
fi
```

State verification (agent-level):
- **V1:** Read the requesting skill's declared workload class (`llm_local_sm`,
  `llm_local_md`, `render_3d_cpu`, `batch_2d`) — thresholds in ARTIFACT B differ per
  class; there is no generic "probably fine."
- **V2:** `pipeline_ethics` context governs preemption: an in-flight render is never
  killed to start a new one without operator approval. On a single-host studio this
  now applies across *every* pair of compute-heavy skills, not just two renders.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Write ARTIFACT A → `tools/hw/verify_compute.sh`, `chmod +x` it. Load ARTIFACT B (threshold matrix).
2. **RUN VERIFICATION** —
   ```bash
   ./tools/hw/verify_compute.sh {{workload_class}} > state/hw_probe_latest.json
   ```
   The script (ARTIFACT A) probes: host + shell kind, memory total/available, page-file
   pressure, power source and battery level, CPU temperature *and* processor-performance
   headroom, GPU kind, disk headroom — and emits one JSON object.
3. **EVALUATE** — Compare probe JSON against ARTIFACT B thresholds for the workload class. Every metric must pass; there is no partial credit.
4. **SINGLE-FLIGHT CHECK** — Before minting, read any existing `state/compute_gate.json`.
   If it is `PASS`, unexpired, and `consumed_by` is null or names a still-running skill,
   **deny** rather than mint: this machine cannot run two heavy jobs at once, and two
   live tokens is how it would try. Note the holder in the deny reason.
5. **MINT / DENY TOKEN** —
   - All pass → write `state/compute_gate.json`: `{"verdict":"PASS","workload":"…","ts_epoch":…,"probe":{…}}`
   - Any fail → `{"verdict":"DENY","reasons":[…]}`, set the requesting pipeline phase to `blocked`, dashboard `system_status.state` → `DEGRADED`, and log remediation (ARTIFACT B `remedies`).
6. **⟪ CONTEXT FLUSH №1 ⟫** — Dashboard writeback of the full `hardware.*` block from the probe. Drop raw probe output; retain verdict line only.
7. **HANDBACK** — Return control to the Router. The requesting skill re-checks the token itself (see blender P4) — trust the file, not the conversation.
8. **CONTINUOUS MODE (recommended, not optional, for jobs over ~5 minutes)** — Re-run
   steps 2–6 every 5 minutes during a long job. On this chassis the first probe is the
   *best* the machine will look: temperature climbs and the performance counter sags as
   the job runs. Two consecutive `DENY`s → signal the running skill to checkpoint-and-pause
   at its next safe frame.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — `verify_compute.sh` (self-extracting bash probe)
```bash
#!/bin/bash
# studio-os :: hardware probe v4 :: usage: verify_compute.sh <workload_class>
# Emits ONE JSON object on stdout. Never mutates system state.
# ONE host — Lenovo Yoga Book 9i, 16 GB shared, Intel integrated graphics — reachable
# from three shells: Windows (Git Bash/MSYS), WSL2, native Linux.
set -uo pipefail
WORKLOAD="${1:-generic}"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) HOST_KIND=windows ;;
  Linux)
    if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
      HOST_KIND=wsl
    else
      HOST_KIND=linux
    fi ;;
  *) HOST_KIND=unknown ;;
esac
HOST_NAME="$(hostname 2>/dev/null || echo unknown)"

num()  { case "${1:-}" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }
jnum() { case "${1:-}" in ''|*[!0-9]*) echo null ;; *) echo "$1" ;; esac; }   # null, never a fake 0

# ── PowerShell bridge ───────────────────────────────────────────────────
# The single source of truth for laptop-level facts under both Windows and WSL.
# Every query is wrapped so a missing class or a denied namespace yields an empty
# line, which jnum() turns into null, which ARTIFACT B's null_law turns into FAIL.
PWSH=""
for c in powershell.exe pwsh.exe pwsh; do
  command -v "$c" >/dev/null 2>&1 && { PWSH="$c"; break; }
done
psq() {
  [ -n "$PWSH" ] || return 1
  "$PWSH" -NoProfile -NonInteractive -Command "try { $1 } catch { '' }" 2>/dev/null \
    | tr -d '\r' | awk 'NF{print;exit}'
}

# ── memory ──────────────────────────────────────────────────────────────
# WSL law: /proc/meminfo inside WSL2 describes the VM, not the laptop. Read the host
# through the bridge or report null — a plausible-looking VM number is worse than none.
MEM_TOTAL_GB=null; MEM_AVAIL_GB=null; SWAP_USED_MB=null
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  MEM_TOTAL_GB=$(jnum "$(psq '[math]::Floor((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)')")
  # AvailableMBytes counts standby + free the way Task Manager does; FreePhysicalMemory
  # alone reads ~2 GB on an idle 16 GB Windows box and would deny every job.
  MEM_AVAIL_MB=$(psq '(Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes')
  [ -z "${MEM_AVAIL_MB:-}" ] && MEM_AVAIL_MB=$(psq '[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)')
  case "${MEM_AVAIL_MB:-}" in ''|*[!0-9]*) MEM_AVAIL_GB=null ;; *) MEM_AVAIL_GB=$(( MEM_AVAIL_MB / 1024 )) ;; esac
  # Windows always has a page file in use; "swap" here means how hard it is leaning on it.
  SWAP_USED_MB=$(jnum "$(psq '[int]((Get-CimInstance Win32_PageFileUsage | Measure-Object -Property CurrentUsage -Sum).Sum)')")
elif [ -r /proc/meminfo ]; then
  MEM_TOTAL_GB=$(awk '/^MemTotal:/{print int($2/1048576)}' /proc/meminfo)
  MEM_AVAIL_GB=$(awk '/^MemAvailable:/{print int($2/1048576)}' /proc/meminfo)
  SWAP_USED_MB=$(awk '/^SwapTotal:/{t=$2} /^SwapFree:/{f=$2} END{print int((t-f)/1024)}' /proc/meminfo)
fi

# FREE percentage — thresholds in ARTIFACT B are `free_pct_min`, so this must be free,
# not used. Unknown inputs propagate as null rather than collapsing to 0 or 100.
if [ "$MEM_TOTAL_GB" != null ] && [ "$MEM_AVAIL_GB" != null ] && [ "$(num "$MEM_TOTAL_GB")" -gt 0 ]; then
  FREE_PCT=$(( MEM_AVAIL_GB * 100 / MEM_TOTAL_GB ))
else
  FREE_PCT=null
fi

# ── dynamic allocation limit for this workload ──────────────────────────
# Law: a workload may claim at most 60% of currently-available memory, and never so
# much that under 4 GB remains for Windows, the shell, and the browser. The old law
# reserved 24 GB — on a 16 GB machine that reserve alone is larger than any job.
if [ "$MEM_AVAIL_GB" != null ] && [ "$MEM_TOTAL_GB" != null ]; then
  CLAIM_GB=$(( MEM_AVAIL_GB * 60 / 100 ))
  [ $(( MEM_TOTAL_GB - CLAIM_GB )) -lt 4 ] && CLAIM_GB=$(( MEM_TOTAL_GB - 4 ))
  [ "$CLAIM_GB" -lt 0 ] && CLAIM_GB=0
else
  CLAIM_GB=null
fi

# ── machine identity ────────────────────────────────────────────────────
# Probed, never asserted: this script's job is to report what it is running on, and a
# hardcoded model name would launder an assumption into a fact. Lenovo puts the four-
# character MTM code in Win32_ComputerSystem.Model ("83FF") and the marketing name in
# Win32_ComputerSystemProduct.Version ("Yoga Book 9 14IMU9"), so prefer Version.
MACHINE="unknown"
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  MACHINE=$(psq '(Get-CimInstance Win32_ComputerSystemProduct).Version')
  [ -z "${MACHINE:-}" ] || [ "${MACHINE:-}" = "None" ] && MACHINE=$(psq '(Get-CimInstance Win32_ComputerSystem).Model')
elif [ -r /sys/class/dmi/id/product_version ]; then
  MACHINE=$(cat /sys/class/dmi/id/product_version 2>/dev/null)
  [ -z "${MACHINE:-}" ] && MACHINE=$(cat /sys/class/dmi/id/product_name 2>/dev/null)
fi
MACHINE="${MACHINE:-unknown}"

# ── GPU ─────────────────────────────────────────────────────────────────
# There is no discrete GPU and no CUDA. The iGPU's "VRAM" is carved out of the same
# 16 GB the thresholds already govern, so reporting a VRAM number would double-count
# memory that memory.* has already claimed. vram_total_gb is null BY DESIGN and no
# workload class names it — see null_law.
GPU_STATUS="integrated"; GPU_NAME="Intel integrated graphics"; GPU_SHARED=true
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  N=$(psq "(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name)")
  [ -n "${N:-}" ] && GPU_NAME="$N"
elif command -v lspci >/dev/null 2>&1; then
  N=$(lspci 2>/dev/null | grep -iE 'vga|3d controller' | head -1 | cut -d: -f3- | sed 's/^ *//')
  [ -n "${N:-}" ] && GPU_NAME="$N"
fi
if command -v nvidia-smi >/dev/null 2>&1; then
  # Not expected on this machine. If it ever appears, say so honestly rather than
  # silently promoting the host to a render node — ARTIFACT B still gates on class.
  GPU_STATUS="discrete"
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
  GPU_SHARED=false
fi

# ── power: a laptop gate the two-machine studio never needed ────────────
# Windows caps sustained CPU/GPU clocks hard on battery, and a long job on battery is
# a job that dies at 3%. AC is a gate for every sustained class in ARTIFACT B.
POWER_SOURCE=null; BATTERY_PCT=null
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  BS=$(psq '(Get-CimInstance Win32_Battery | Select-Object -First 1 -ExpandProperty BatteryStatus)')
  BATTERY_PCT=$(jnum "$(psq '(Get-CimInstance Win32_Battery | Select-Object -First 1 -ExpandProperty EstimatedChargeRemaining)')")
  case "${BS:-}" in
    1)  POWER_SOURCE='"battery"' ;;
    '') # no battery DEVICE at all -> a mains-only machine, which is on AC by definition.
        # Distinct from "there is a battery and we could not read it", which stays null.
        HAS_BAT=$(psq '(@(Get-CimInstance Win32_Battery)).Count')
        [ "${HAS_BAT:-1}" = 0 ] && POWER_SOURCE='"ac"' || POWER_SOURCE=null ;;
    *[!0-9]*) POWER_SOURCE=null ;;
    *)  POWER_SOURCE='"ac"' ;;   # 2 = AC; 3..11 are charging/charged states, all on AC
  esac
elif [ -d /sys/class/power_supply ]; then
  for ac in /sys/class/power_supply/A{C,DP}*/online; do
    [ -r "$ac" ] && { [ "$(cat "$ac")" = 1 ] && POWER_SOURCE='"ac"' || POWER_SOURCE='"battery"'; break; }
  done
  for b in /sys/class/power_supply/BAT*/capacity; do
    [ -r "$b" ] && { BATTERY_PCT=$(jnum "$(cat "$b")"); break; }
  done
  # mains-only machine: no battery device present at all
  [ "$POWER_SOURCE" = null ] && ! ls -d /sys/class/power_supply/BAT* >/dev/null 2>&1 && POWER_SOURCE='"ac"' 
fi

# ── thermal headroom: two independent readings, both allowed to be null ─
# cpu_temp_c is the direct measure and is frequently unreadable on consumer Windows
# laptops (MSAcpi_ThermalZoneTemperature is often access-denied or unimplemented).
# cpu_perf_pct is processor performance against nominal clock: it sags under thermal
# AND power throttling, which on this chassis is the failure that actually happens.
# ARTIFACT B requires AT LEAST ONE to be readable, and every readable one to pass.
CPU_TEMP_C=null; CPU_PERF_PCT=null
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  T=$(psq '[int](((Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentTemperature)/10)-273.15)')
  CPU_TEMP_C=$(jnum "${T:-}")
  CPU_PERF_PCT=$(jnum "$(psq "[int]((Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation | Where-Object Name -eq '_Total' | Select-Object -First 1 -ExpandProperty PercentProcessorPerformance))")")
else
  if [ -r /sys/class/thermal/thermal_zone0/temp ]; then
    CPU_TEMP_C=$(jnum "$(awk '{print int($1/1000)}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null)")
  elif command -v sensors >/dev/null 2>&1; then
    CPU_TEMP_C=$(jnum "$(sensors 2>/dev/null | awk '/Tctl|Tdie|Package id 0/{for(i=1;i<=NF;i++) if($i~/^\+[0-9]/){gsub(/[^0-9.]/,"",$i); print int($i); exit}}')")
  fi
  if [ -r /proc/cpuinfo ] && [ -r /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq ]; then
    CUR=$(awk -F: '/cpu MHz/{gsub(/ /,"",$2); print int($2); exit}' /proc/cpuinfo)
    MAXK=$(cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq)
    [ -n "${CUR:-}" ] && [ "${MAXK:-0}" -gt 0 ] && CPU_PERF_PCT=$(( CUR * 100000 / MAXK ))
  fi
fi

# ── disk ────────────────────────────────────────────────────────────────
# Two volumes matter and they are not always the same one: the volume this repo sits
# on (renders, model weights, index shards) and the Windows system volume (page file).
DISK_FREE_GB=$(num "$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}')")
SYS_FREE_GB=null
if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
  SYS_FREE_GB=$(jnum "$(psq "[math]::Floor((Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\").FreeSpace/1GB)")")
else
  SYS_FREE_GB=$(num "$(df -Pk / 2>/dev/null | awk 'NR==2{print int($4/1048576)}')")
fi

cat <<JSON
{
  "workload": "$WORKLOAD",
  "ts_epoch": $(date +%s),
  "host": { "name": "$HOST_NAME", "kind": "$HOST_KIND", "machine": "$MACHINE" },
  "gpu": {
    "status": "$GPU_STATUS",
    "name": "${GPU_NAME:-unknown}",
    "vram_total_gb": null,
    "memory_shared_with_system": $GPU_SHARED
  },
  "memory": {
    "total_gb": $MEM_TOTAL_GB,
    "available_gb": $MEM_AVAIL_GB,
    "free_pct": $FREE_PCT,
    "swap_used_mb": $SWAP_USED_MB,
    "dynamic_claim_limit_gb": $CLAIM_GB
  },
  "power": { "source": $POWER_SOURCE, "battery_pct": $BATTERY_PCT },
  "thermal": { "cpu_temp_c": $CPU_TEMP_C, "cpu_perf_pct": $CPU_PERF_PCT },
  "disk": { "free_gb": $DISK_FREE_GB, "system_free_gb": $SYS_FREE_GB }
}
JSON
```

### ARTIFACT B — Threshold Matrix + Remedies (the gate's law table)
```json
{
  "machine": "Lenovo Yoga Book 9i · 16 GB shared · Intel integrated graphics · no CUDA",
  "thresholds": {
    "llm_local_sm": {
      "_for": "≤8B parameters at Q4_K_M, num_ctx ≤ 8192 — the everyday local model",
      "memory.available_gb_min": 6,
      "memory.free_pct_min": 30,
      "memory.swap_used_mb_max": 6144,
      "power.source_in": ["ac", "battery"],
      "thermal.cpu_temp_c_max": 90,
      "thermal.cpu_perf_pct_min": 65,
      "disk.free_gb_min": 12
    },
    "llm_local_md": {
      "_for": "12–14B at Q4_K_M, num_ctx ≤ 4096 — the ceiling this machine can hold",
      "memory.available_gb_min": 10,
      "memory.free_pct_min": 45,
      "memory.swap_used_mb_max": 3072,
      "power.source_in": ["ac"],
      "thermal.cpu_temp_c_max": 85,
      "thermal.cpu_perf_pct_min": 80,
      "disk.free_gb_min": 20
    },
    "render_3d_cpu": {
      "_for": "Blender EEVEE, or Cycles on CPU. There is no CUDA and no OptiX here.",
      "gpu.status": "any",
      "memory.available_gb_min": 8,
      "memory.free_pct_min": 40,
      "memory.swap_used_mb_max": 3072,
      "power.source_in": ["ac"],
      "thermal.cpu_temp_c_max": 80,
      "thermal.cpu_perf_pct_min": 85,
      "disk.free_gb_min": 20
    },
    "batch_2d": {
      "_for": "Adobe batch export/grade via the COM bridge",
      "gpu.status": "any",
      "memory.available_gb_min": 5,
      "memory.free_pct_min": 25,
      "memory.swap_used_mb_max": 6144,
      "power.source_in": ["ac"],
      "thermal.cpu_temp_c_max": 90,
      "thermal.cpu_perf_pct_min": 65,
      "disk.free_gb_min": 10
    }
  },
  "evaluation_law": "ALL metrics named for the class must pass. dynamic_claim_limit_gb from the probe becomes the hard memory budget passed to the requesting skill (Blender tile/scene budget, Ollama num_ctx and model tier, Adobe batch size).",
  "null_law": "A metric the probe could not read is emitted as null and evaluates to FAIL for any class whose thresholds name it. A metric no class names — gpu.vram_total_gb on this machine — is null as a statement of fact, not a failure: the iGPU has no dedicated VRAM to report, and memory.* already governs the pool it borrows from. An unverifiable gate is a closed gate; an inapplicable one was never a gate.",
  "thermal_law": "cpu_temp_c and cpu_perf_pct are two independent readings of the same limit. At least ONE must be readable, and every readable one must pass. Requiring both would close the gate permanently on consumer Windows hardware, where MSAcpi_ThermalZoneTemperature is routinely denied; requiring neither would let a throttling laptop pass as healthy. cpu_perf_pct is the load-bearing one on this chassis — it sags under thermal and power throttling alike.",
  "host_law": "There is exactly one host and it is this laptop: host.kind must be windows, wsl, or linux. macOS is not a supported host — the Adobe and Blender bridges are Windows COM and Windows paths (DECISIONS.md § D8). host.kind macos, or a probe reporting a discrete CUDA GPU, means the route is running somewhere this system was not ported to: refuse rather than adapt.",
  "single_flight_law": "One heavy job at a time. Before minting, an existing PASS token that is unexpired and either unconsumed or held by a running skill DENIES the new request, whatever the probe says. The two-machine studio could render on the node while Adobe ran on the host; here both would be fighting over the same 16 GB and the same thermal budget.",
  "wsl_memory_law": "Inside WSL2, /proc/meminfo describes the WSL virtual machine, not the laptop. Memory MUST come through the PowerShell bridge; with no bridge the memory metrics are null and the gate closes. A plausible-looking VM number is more dangerous than no number.",
  "remedies": {
    "on battery": "plug in. Windows caps sustained clocks on battery and every class except llm_local_sm requires AC. Re-probe after the charge state settles.",
    "low battery on ac": "battery_pct under ~20 while charging still means a shared power budget — prefer waiting, or run llm_local_sm rather than llm_local_md.",
    "thermal unreadable (both null)": "no readable sensor and no readable performance counter — check that the PowerShell bridge works (`powershell.exe -NoProfile -Command '(Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation | Where-Object Name -eq \"_Total\").PercentProcessorPerformance'`). Null never passes.",
    "cpu_perf_pct low": "the machine is already throttling: close the second screen's heavy apps, let it cool, or reduce the class (llm_local_md → llm_local_sm). A job started at 60% performance finishes at 60% performance.",
    "low available_gb": "quit Adobe apps not in the active phase; unload the resident model (`ollama stop <model>`); close browser tabs — 16 GB is the whole studio now. Re-probe.",
    "swap rising": "Windows is leaning on the page file — DENY stands until CurrentUsage stabilizes across two probes. On a soldered-16 GB machine this is the normal precursor to a stall, not a curiosity.",
    "gpu discrete unexpectedly": "this system is ported to the Yoga Book 9i. A discrete GPU means it is running on some other machine — re-verify DECISIONS.md § D8 before trusting any threshold in this table.",
    "low disk": "model weights and render output share one SSD. Archive renders/ to external storage per pipeline_ethics retention rules; `ollama rm` unused model tiers.",
    "single-flight deny": "another workload holds a live token. Wait for it to finish, or if it died without consuming the token, delete state/compute_gate.json and re-probe."
  }
}
```

### ARTIFACT C — Gate Token Schema (`state/compute_gate.json`)
```json
{
  "verdict": "PASS",
  "workload": "llm_local_sm",
  "ts_epoch": 1751360531,
  "ttl_seconds": 1800,
  "memory_budget_gb": 6,
  "probe_snapshot": { "gpu": "integrated", "available_gb": 11, "power": "ac", "cpu_perf_pct": 94, "thermal_c": null },
  "consumed_by": null,
  "law": "one token, one workload. The consuming skill writes its skill_id into consumed_by; a consumed token cannot authorize a second job. Under single_flight_law a live token also blocks minting a token for any OTHER workload."
}
```

— END OF SKILL —
