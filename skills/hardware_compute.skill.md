# hardware_compute.skill.md — COMPUTE VERIFICATION & ALLOCATION GATE
### Studio Headless OS · Skill 8/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: hardware_compute
version: 1.0
trigger_a: ["render locally", "GPU", "heavy compute", "batch process", "out of memory", "thermals"]
trigger_b: ["ANY task where another skill declares danger_class: LOCAL_COMPUTE_HEAVY"]
mandatory_context: [pipeline_ethics, render_philosophy]
version_note: v1.1 — probe is host-aware (macOS host + Linux/Windows compute node)
writes_dashboard_keys: [hardware.*, system_status.state]
danger_class: GATEKEEPER   # this skill blocks other skills; it never launches compute itself
gate_token_path: state/compute_gate.json
gate_ttl_seconds: 1800
```

This skill is the **hardware bouncer**. It runs on whichever machine will do the work: the macOS host for `batch_2d`/`llm_671b`, the Linux/Windows compute node for `render_3d`. Compute-heavy skills (`blender_python`, `local_rag_orchestration`, batch `adobe_suite_uxp`) may not run unless a fresh `PASS` token exists at `state/compute_gate.json`. The token expires in 30 minutes — hardware truths go stale.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Identify which machine we are on. The studio is TWO machines:
#      the macOS host (Adobe, osascript, orchestration) and a Linux/Windows
#      CUDA compute node on the LAN. A probe that assumes one will lie about the other.
case "$(uname -s)" in
  Darwin) STUDIO_HOST_KIND=macos ;;
  Linux)  STUDIO_HOST_KIND=linux ;;
  MINGW*|MSYS*|CYGWIN*) STUDIO_HOST_KIND=windows ;;
  *)      STUDIO_HOST_KIND=unknown ;;
esac
export STUDIO_HOST_KIND
[ "$STUDIO_HOST_KIND" = unknown ] && echo "FAIL:P2 unrecognized host" || echo "OK:P2 ($STUDIO_HOST_KIND)"

# P3 — Tools available for THIS host kind (never require nvidia-smi on the Mac host)
case "$STUDIO_HOST_KIND" in
  macos) REQ="sysctl vm_stat awk df" ;;
  *)     REQ="awk df grep" ;;
esac
for t in $REQ; do
  command -v "$t" >/dev/null 2>&1 || echo "FAIL:P3 missing $t"
done; echo "OK:P3"
```

State verification (agent-level):
- **V1:** Read the requesting skill's declared workload class (`render_3d`, `llm_671b`, `batch_2d`) — thresholds in ARTIFACT B differ per class; there is no generic "probably fine."
- **V2:** `pipeline_ethics` context governs preemption: an in-flight render is never killed to start a new one without operator approval.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Write ARTIFACT A → `tools/hw/verify_compute.sh`, `chmod +x` it. Load ARTIFACT B (threshold matrix).
2. **RUN VERIFICATION** —
   ```bash
   ./tools/hw/verify_compute.sh {{workload_class}} > state/hw_probe_latest.json
   ```
   The script (ARTIFACT A) probes: discrete GPU (nvidia-smi VRAM), system RAM total/free, memory pressure, swap activity, CPU thermals, disk headroom — and emits one JSON object.
3. **EVALUATE** — Compare probe JSON against ARTIFACT B thresholds for the workload class. Every metric must pass; there is no partial credit.
4. **MINT / DENY TOKEN** —
   - All pass → write `state/compute_gate.json`: `{"verdict":"PASS","workload":"…","ts_epoch":…,"probe":{…}}`
   - Any fail → `{"verdict":"DENY","reasons":[…]}`, set the requesting pipeline phase to `blocked`, dashboard `system_status.state` → `DEGRADED`, and log remediation (ARTIFACT B `remedies`).
5. **⟪ CONTEXT FLUSH №1 ⟫** — Dashboard writeback of the full `hardware.*` block from the probe. Drop raw probe output; retain verdict line only.
6. **HANDBACK** — Return control to the Router. The requesting skill re-checks the token itself (see blender P4) — trust the file, not the conversation.
7. **CONTINUOUS MODE (optional, long renders)** — Re-run steps 2–5 every 10 minutes during a render; two consecutive `DENY`s → signal the running skill to checkpoint-and-pause at its next safe frame.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — `verify_compute.sh` (self-extracting bash probe)
```bash
#!/bin/bash
# studio-os :: hardware probe v3 :: usage: verify_compute.sh <workload_class>
# Emits ONE JSON object on stdout. Never mutates system state.
# Host-aware: macOS studio host (Apple silicon) and Linux/Windows CUDA compute node.
set -uo pipefail
WORKLOAD="${1:-generic}"

case "$(uname -s)" in
  Darwin) HOST_KIND=macos ;;
  Linux)  HOST_KIND=linux ;;
  MINGW*|MSYS*|CYGWIN*) HOST_KIND=windows ;;
  *)      HOST_KIND=unknown ;;
esac
HOST_NAME="$(hostname 2>/dev/null || echo unknown)"

num() { case "${1:-}" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }

# ── GPU probe ───────────────────────────────────────────────────────────
# CUDA node -> nvidia-smi. Apple silicon -> unified memory IS the VRAM, so it
# reports as integrated rather than pretending a discrete card is absent.
GPU_NAME="none"; GPU_VRAM_TOTAL_GB=0; GPU_VRAM_USED_GB=0; GPU_STATUS="absent"
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null | head -1)
  GPU_VRAM_TOTAL_GB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | awk '{print int($1/1024)}')
  GPU_VRAM_USED_GB=$(nvidia-smi --query-gpu=memory.used  --format=csv,noheader,nounits 2>/dev/null | head -1 | awk '{print int($1/1024)}')
  [ -n "$GPU_NAME" ] && GPU_STATUS="available"
elif [ "$HOST_KIND" = macos ]; then
  GPU_NAME=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple silicon")
  GPU_STATUS="integrated"
fi

# ── memory: total + genuinely available ─────────────────────────────────
MEM_TOTAL_GB=0; MEM_AVAIL_GB=0; SWAP_USED_MB=0
if [ "$HOST_KIND" = macos ]; then
  MEM_TOTAL_GB=$(sysctl -n hw.memsize 2>/dev/null | awk '{print int($1/1073741824)}')
  PAGE=$(sysctl -n hw.pagesize 2>/dev/null || echo 4096)
  # "available" on macOS = free + inactive + speculative + purgeable-ish (file-backed)
  MEM_AVAIL_GB=$(vm_stat 2>/dev/null | awk -v pg="$PAGE" '
    /Pages free/{f=$3} /Pages inactive/{i=$3} /Pages speculative/{s=$3} /File-backed pages/{b=$3}
    END{gsub(/\./,"",f); gsub(/\./,"",i); gsub(/\./,"",s); gsub(/\./,"",b);
        print int((f+i+s+b)*pg/1073741824)}')
  SWAP_USED_MB=$(sysctl -n vm.swapusage 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="used"){gsub(/[^0-9.]/,"",$(i+2)); print int($(i+2)); exit}}')
elif [ -r /proc/meminfo ]; then
  MEM_TOTAL_GB=$(awk '/^MemTotal:/{print int($2/1048576)}' /proc/meminfo)
  MEM_AVAIL_GB=$(awk '/^MemAvailable:/{print int($2/1048576)}' /proc/meminfo)
  SWAP_USED_MB=$(awk '/^SwapTotal:/{t=$2} /^SwapFree:/{f=$2} END{print int((t-f)/1024)}' /proc/meminfo)
elif command -v free >/dev/null 2>&1; then
  MEM_TOTAL_GB=$(free -g | awk '/^Mem:/{print $2}')
  MEM_AVAIL_GB=$(free -g | awk '/^Mem:/{print $7}')
fi
MEM_TOTAL_GB=$(num "$MEM_TOTAL_GB"); MEM_AVAIL_GB=$(num "$MEM_AVAIL_GB"); SWAP_USED_MB=$(num "$SWAP_USED_MB")

# FREE percentage — the thresholds in ARTIFACT B are `free_pct_min`, so this must
# be free, not used. (v2 emitted 100-free under the name free_pct, which inverted
# the gate: a nearly-full machine passed and an idle one was denied.)
if [ "$MEM_TOTAL_GB" -gt 0 ]; then
  FREE_PCT=$(( MEM_AVAIL_GB * 100 / MEM_TOTAL_GB ))
else
  FREE_PCT=0
fi

# ── dynamic allocation limit for this workload ──────────────────────────
# Law: a workload may claim at most 70% of currently-available memory, and never
# so much that <24GB remains for the OS + Adobe suite.
CLAIM_GB=$(( MEM_AVAIL_GB * 70 / 100 ))
[ $(( MEM_TOTAL_GB - CLAIM_GB )) -lt 24 ] && CLAIM_GB=$(( MEM_TOTAL_GB - 24 ))
[ "$CLAIM_GB" -lt 0 ] && CLAIM_GB=0

# ── thermals ────────────────────────────────────────────────────────────
THERM=""
if [ "$HOST_KIND" = macos ]; then
  THERM=$(osx-cpu-temp 2>/dev/null | awk '{gsub(/[^0-9.]/,""); print int($0); exit}')
elif [ -r /sys/class/thermal/thermal_zone0/temp ]; then
  THERM=$(awk '{print int($1/1000)}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null)
elif command -v sensors >/dev/null 2>&1; then
  THERM=$(sensors 2>/dev/null | awk '/Tctl|Tdie|Package id 0/{for(i=1;i<=NF;i++) if($i~/^\+[0-9]/){gsub(/[^0-9.]/,"",$i); print int($i); exit}}')
fi
# Unreadable thermals are reported as unknown, NOT as a safe number. The evaluator
# treats null as "cannot verify" -> DENY for thermally-bounded classes.
case "$THERM" in ''|*[!0-9]*) THERM=null ;; esac

# ── disk headroom on render volume (POSIX -P avoids long-device line wrap) ──
DISK_FREE_GB=$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}')
DISK_FREE_GB=$(num "$DISK_FREE_GB")

cat <<JSON
{
  "workload": "$WORKLOAD",
  "ts_epoch": $(date +%s),
  "host": { "name": "$HOST_NAME", "kind": "$HOST_KIND" },
  "gpu": {
    "status": "$GPU_STATUS",
    "name": "${GPU_NAME:-none}",
    "vram_total_gb": $(num "$GPU_VRAM_TOTAL_GB"),
    "vram_used_gb": $(num "$GPU_VRAM_USED_GB")
  },
  "memory": {
    "total_gb": $MEM_TOTAL_GB,
    "available_gb": $MEM_AVAIL_GB,
    "free_pct": $FREE_PCT,
    "swap_used_mb": $SWAP_USED_MB,
    "dynamic_claim_limit_gb": $CLAIM_GB
  },
  "thermal": { "cpu_temp_c": $THERM },
  "disk": { "free_gb": $DISK_FREE_GB }
}
JSON
```

### ARTIFACT B — Threshold Matrix + Remedies (the gate's law table)
```json
{
  "thresholds": {
    "render_3d": {
      "gpu.status": "available",
      "host.kind_in": ["linux", "windows"],
      "gpu.vram_total_gb_min": 8,
      "memory.available_gb_min": 32,
      "memory.free_pct_min": 25,
      "thermal.cpu_temp_c_max": 85,
      "disk.free_gb_min": 100
    },
    "llm_671b": {
      "gpu.status": "any",
      "memory.available_gb_min": 140,
      "memory.free_pct_min": 20,
      "memory.swap_used_mb_max": 100,
      "thermal.cpu_temp_c_max": 85,
      "disk.free_gb_min": 50
    },
    "batch_2d": {
      "gpu.status": "any",
      "memory.available_gb_min": 24,
      "memory.free_pct_min": 20,
      "thermal.cpu_temp_c_max": 90,
      "disk.free_gb_min": 40
    }
  },
  "evaluation_law": "ALL metrics for the class must pass. dynamic_claim_limit_gb from the probe becomes the hard memory budget passed to the requesting skill (e.g. Blender tile/scene budget, llama.cpp --mlock sizing).",
  "null_law": "A metric the probe could not read is emitted as null and evaluates to FAIL, never to pass-by-default. thermal.cpu_temp_c is null on hosts without a readable sensor: install a sensor shim on that host or run the workload on one that has it. An unverifiable gate is a closed gate.",
  "host_law": "render_3d requires the CUDA compute node (host.kind linux|windows, gpu.status available). llm_671b and batch_2d run on the macOS studio host, where gpu.status is 'integrated' and unified memory serves as VRAM — do not read 'integrated' as 'absent'.",
  "remedies": {
    "gpu absent": "on the compute node: check NVIDIA driver (nvidia-smi), verify the GPU is seated and powered, re-probe. If this fired on the macOS host, the route is wrong — render_3d belongs on the node.",
    "thermal null": "no readable sensor on this host — install one (lm-sensors on Linux, a CPU-temp shim on macOS) or move the workload; null never passes",
    "low available_gb": "quit Adobe apps not in the active phase; unload resident LLM (ollama stop); re-probe",
    "swap rising": "system is already paging — DENY stands until swap stabilizes across two probes",
    "thermal throttle": "wait for cpu_temp_c ≤ threshold; check ambient/vents/fans; long renders should schedule overnight",
    "low disk": "archive renders/ to cold storage per pipeline_ethics retention rules"
  }
}
```

### ARTIFACT C — Gate Token Schema (`state/compute_gate.json`)
```json
{
  "verdict": "PASS",
  "workload": "render_3d",
  "ts_epoch": 1751360531,
  "ttl_seconds": 1800,
  "memory_budget_gb": 96,
  "probe_snapshot": { "gpu": "available", "available_gb": 138, "thermal_c": 65 },
  "consumed_by": null,
  "law": "one token, one workload. The consuming skill writes its skill_id into consumed_by; a consumed token cannot authorize a second job."
}
```

— END OF SKILL —
