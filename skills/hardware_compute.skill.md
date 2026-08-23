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
writes_dashboard_keys: [hardware.*, system_status.state]
danger_class: GATEKEEPER   # this skill blocks other skills; it never launches compute itself
gate_token_path: state/compute_gate.json
gate_ttl_seconds: 1800
```

This skill is the **hardware bouncer**. Compute-heavy skills (`blender_python`, `local_rag_orchestration`, batch `adobe_suite_uxp`) may not run unless a fresh `PASS` token exists at `state/compute_gate.json`. The token expires in 30 minutes — hardware truths go stale.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — We are on the target Lenovo PC (not a remote host or WSL drift)
if command -v wmic >/dev/null 2>&1; then echo "OK:P2 (Windows)"
elif command -v nvidia-smi >/dev/null 2>&1 || [ -f /proc/cpuinfo ]; then echo "OK:P2 (Linux/PC)"
else echo "FAIL:P2 wrong host"; fi

# P3 — Shell tools available (Linux/Windows PC standard tools)
for t in nvidia-smi free grep awk df; do
  command -v $t >/dev/null || echo "FAIL:P3 missing $t"
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
# studio-os :: hardware probe v2 (PC/Lenovo) :: usage: verify_compute.sh <workload_class>
# Emits ONE JSON object on stdout. Never mutates system state.
set -uo pipefail
WORKLOAD="${1:-generic}"

# ── discrete GPU probe (nvidia-smi) ─────────────────────────────────────
GPU_NAME="none"
GPU_VRAM_TOTAL_GB=0
GPU_VRAM_USED_GB=0
GPU_STATUS="absent"
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null | head -1)
  GPU_VRAM_TOTAL_GB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | awk '{print int($1/1024)}')
  GPU_VRAM_USED_GB=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | awk '{print int($1/1024)}')
  [ -n "$GPU_NAME" ] && GPU_STATUS="available"
fi

# ── system RAM: total, available (Linux/PC standard) ────────────────────
MEM_TOTAL_GB=0
MEM_AVAIL_GB=0
SWAP_USED_MB=0
if [ -f /proc/meminfo ]; then
  MEM_TOTAL_GB=$(awk '/MemTotal/{print int($2/1048576)}' /proc/meminfo)
  MEM_AVAIL_GB=$(awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo)
  SWAP_USED_MB=$(awk '/SwapTotal/{t=$2} /SwapFree/{f=$2} END{print int((t-f)/1024)}' /proc/meminfo)
elif command -v free >/dev/null 2>&1; then
  MEM_TOTAL_GB=$(free -g | awk '/^Mem:/{print $2}')
  MEM_AVAIL_GB=$(free -g | awk '/^Mem:/{print $7}')
fi
PRESSURE=$(( 100 - (MEM_AVAIL_GB * 100 / (MEM_TOTAL_GB > 0 ? MEM_TOTAL_GB : 1)) ))

# ── dynamic allocation limit for this workload ──────────────────────────
# Law: a workload may claim at most 70% of currently-available memory,
# and never so much that <24GB remains for the OS + Adobe suite.
CLAIM_GB=$(( MEM_AVAIL_GB * 70 / 100 ))
HEADROOM=$(( MEM_TOTAL_GB - CLAIM_GB ))
[ "$HEADROOM" -lt 24 ] && CLAIM_GB=$(( MEM_TOTAL_GB - 24 ))
[ "$CLAIM_GB" -lt 0 ] && CLAIM_GB=0

# ── thermals (Linux standard paths) ─────────────────────────────────────
THERM=100
if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
  THERM_ZONE=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null)
  [ -n "$THERM_ZONE" ] && THERM=$(( THERM_ZONE / 1000 ))
elif command -v sensors >/dev/null 2>&1; then
  THERM=$(sensors 2>/dev/null | awk '/Tctl|Tdie|Package id 0/{for(i=1;i<=NF;i++)if($i~ /^\+[0-9]/){print int($i);exit}}')
fi
THERM=${THERM:-100}

# ── disk headroom on render volume ──────────────────────────────────────
DISK_FREE_GB=$(df -BG . | awk 'NR==2{print $4}' | tr -d 'G')

cat <<JSON
{
  "workload": "$WORKLOAD",
  "ts_epoch": $(date +%s),
  "host": "Lenovo PC",
  "gpu": {
    "status": "$GPU_STATUS",
    "name": "${GPU_NAME:-none}",
    "vram_total_gb": ${GPU_VRAM_TOTAL_GB:-0},
    "vram_used_gb": ${GPU_VRAM_USED_GB:-0}
  },
  "memory": {
    "total_gb": ${MEM_TOTAL_GB:-0},
    "available_gb": ${MEM_AVAIL_GB:-0},
    "free_pct": ${PRESSURE:-0},
    "swap_used_mb": ${SWAP_USED_MB:-0},
    "dynamic_claim_limit_gb": ${CLAIM_GB:-0}
  },
  "thermal": { "cpu_temp_c": ${THERM} },
  "disk": { "free_gb": ${DISK_FREE_GB:-0} }
}
JSON
```

### ARTIFACT B — Threshold Matrix + Remedies (the gate's law table)
```json
{
  "thresholds": {
    "render_3d": {
      "gpu.status": "available",
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
  "remedies": {
    "gpu absent": "check NVIDIA driver (nvidia-smi); verify GPU is seated and powered; re-probe after fix",
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
