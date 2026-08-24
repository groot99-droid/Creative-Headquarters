#!/usr/bin/env bash
# bootstrap.sh — first boot for Studio Headless OS on the studio laptop.
#
# Run this once on a fresh machine, and again any time the environment changes
# (new Ollama model, Blender install, WSL vs Git Bash switch). It:
#
#   1. identifies the shell it is running in and refuses unsupported hosts
#   2. checks prerequisites, hard and soft, and says which is which
#   3. extracts the probe from hardware_compute ARTIFACT A (never a second copy)
#   4. runs the probe and evaluates every workload class against ARTIFACT B
#
# It mutates nothing outside state/ and tools/hw/, and mints no gate token.
#
#   bash tools/bootstrap.sh            # full first boot
#   bash tools/bootstrap.sh --probe    # re-probe only, skip prerequisites
#
# Exit 0 = ready, 1 = a hard prerequisite is missing.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
ROOT="$PWD"
SKILL="skills/hardware_compute.skill.md"
PROBE_OUT="state/hw_probe_latest.json"
HARD_FAIL=0
PROBE_ONLY=0
[ "${1:-}" = "--probe" ] && PROBE_ONLY=1

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[92mok  \033[0m %s\n' "$*"; }
warn() { printf '  \033[93mwarn\033[0m %s\n' "$*"; }
bad()  { printf '  \033[91mFAIL\033[0m %s\n' "$*"; HARD_FAIL=1; }

# ── 1. which shell are we in ────────────────────────────────────────────
say "1. Host"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) HOST_KIND=windows ;;
  Linux)
    if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
      HOST_KIND=wsl
    else
      HOST_KIND=linux
    fi ;;
  Darwin) HOST_KIND=macos ;;
  *)      HOST_KIND=unknown ;;
esac

case "$HOST_KIND" in
  windows) ok "Git Bash / MSYS on Windows — native paths, PowerShell directly available" ;;
  wsl)     ok "WSL2 — /proc describes the VM, not the laptop; the probe reads memory through PowerShell" ;;
  linux)   ok "native Linux — no Adobe bridge here; adobe_suite_uxp will not route" ;;
  macos)   bad "macOS is not a supported host (DECISIONS.md § D8). This system was ported off it." ;;
  *)       bad "unrecognized host: $(uname -s)" ;;
esac

if [ "$PROBE_ONLY" = 0 ]; then
  # ── 2. prerequisites ──────────────────────────────────────────────────
  say "2. Prerequisites"

  for t in python3 curl awk df grep; do
    command -v "$t" >/dev/null 2>&1 && ok "$t" || bad "$t missing — required by every skill's prerequisite block"
  done

  PWSH=""
  for c in powershell.exe pwsh.exe pwsh; do
    command -v "$c" >/dev/null 2>&1 && { PWSH="$c"; break; }
  done
  if [ "$HOST_KIND" = windows ] || [ "$HOST_KIND" = wsl ]; then
    if [ -n "$PWSH" ]; then
      ok "PowerShell bridge ($PWSH) — memory, power and thermals come through this"
    else
      bad "no powershell.exe on PATH — the probe cannot read this laptop's real memory (wsl_memory_law)"
    fi
  fi

  # Ollama. On WSL the endpoint usually is NOT localhost: under default NAT networking
  # that is the WSL VM. Try localhost first, then the Windows gateway.
  say "3. Local models (Ollama)"
  ENDPOINT=$(python3 -c "import json;print(json.load(open('dashboard.json'))['hardware']['local_llm']['endpoint'])" 2>/dev/null)
  REACHED=""
  if curl -s --max-time 4 "$ENDPOINT/api/tags" >/dev/null 2>&1; then
    REACHED="$ENDPOINT"
  elif [ "$HOST_KIND" = wsl ]; then
    GW=$(ip route show default 2>/dev/null | awk '{print $3; exit}')
    ALT=$(echo "$ENDPOINT" | sed "s#//[^:/]*#//$GW#")
    if [ -n "$GW" ] && curl -s --max-time 4 "$ALT/api/tags" >/dev/null 2>&1; then
      REACHED="$ALT"
      warn "reachable at $ALT, not $ENDPOINT — from WSL, localhost is the VM"
      warn "  the Windows side needs OLLAMA_HOST=0.0.0.0 and an inbound rule for 11434"
    fi
  fi

  if [ -n "$REACHED" ]; then
    ok "Ollama reachable at $REACHED"
    python3 tools/reconcile_models.py --endpoint "$REACHED" 2>/dev/null \
      || warn "could not reconcile the model registry — run tools/reconcile_models.py by hand"
  else
    warn "Ollama not reachable at $ENDPOINT — install it and 'ollama pull' a model;"
    warn "  local_rag_orchestration is the only skill that needs it, so this is not fatal"
  fi

  # ── 4. native app bridges (soft: only some routes need them) ──────────
  say "4. Native bridges"
  if [ -n "$PWSH" ]; then
    # Test-Path on the registry ProgID, NOT New-Object — instantiating the COM object
    # would launch Photoshop, which is not something a preflight check should do.
    for app in Photoshop.Application Illustrator.Application AfterFX.Application; do
      R=$("$PWSH" -NoProfile -NonInteractive -Command \
            "if (Test-Path 'HKLM:\\SOFTWARE\\Classes\\$app') {'yes'} else {'no'}" 2>/dev/null | tr -d '\r')
      [ "$R" = yes ] && ok "$app registered" || warn "$app not registered — routes needing it will park"
    done
  fi

  BL=""
  if [ -n "${BLENDER_BIN:-}" ]; then BL="$BLENDER_BIN"
  elif command -v blender >/dev/null 2>&1; then BL=$(command -v blender)
  else
    for root in "/c/Program Files/Blender Foundation" "/mnt/c/Program Files/Blender Foundation"; do
      for cand in "$root"/Blender*/blender.exe; do [ -x "$cand" ] && BL="$cand" && break 2; done
    done
  fi
  if [ -n "$BL" ]; then
    ok "Blender: $("$BL" --version 2>/dev/null | head -1) — $BL"
  else
    warn "Blender not found — set BLENDER_BIN, or blender_python will park"
  fi
fi

# ── 5. extract the probe from the skill file ────────────────────────────
say "5. Probe"
mkdir -p state tools/hw .task_scratch
if [ ! -f "$SKILL" ]; then
  bad "$SKILL missing — cannot extract ARTIFACT A"
else
  python3 - "$SKILL" <<'PY' > tools/hw/verify_compute.sh
import re, sys
t = open(sys.argv[1]).read()
m = re.search(r"### ARTIFACT A.*?\n```bash\n(.*?)\n```", t, re.S)
if not m:
    sys.exit("ARTIFACT A not found in the skill file")
sys.stdout.write(m.group(1) + "\n")
PY
  if [ -s tools/hw/verify_compute.sh ]; then
    chmod +x tools/hw/verify_compute.sh
    bash -n tools/hw/verify_compute.sh 2>/dev/null \
      && ok "extracted ARTIFACT A -> tools/hw/verify_compute.sh ($(wc -l < tools/hw/verify_compute.sh) lines, syntax ok)" \
      || bad "extracted probe does not parse as bash — the skill file's ARTIFACT A is broken"
  else
    bad "extraction produced nothing — is ARTIFACT A still a \`\`\`bash block?"
  fi
fi

if [ "$HARD_FAIL" = 1 ]; then
  say "Result"
  printf '  \033[91mNot ready.\033[0m Fix the FAIL lines above and run this again.\n\n'
  exit 1
fi

./tools/hw/verify_compute.sh generic > "$PROBE_OUT" 2>/dev/null
if python3 -c "import json,sys;json.load(open('$PROBE_OUT'))" 2>/dev/null; then
  ok "probe ran -> $PROBE_OUT"
  python3 -c "
import json
p = json.load(open('$PROBE_OUT'))
print('       machine: %s (%s)' % (p['host']['machine'], p['host']['kind']))
m = p['memory']; print('       memory : %s GB total, %s available, claim limit %s GB' % (m['total_gb'], m['available_gb'], m['dynamic_claim_limit_gb']))
print('       power  : %s (battery %s%%)' % (p['power']['source'], p['power']['battery_pct']))
print('       thermal: %s C / %s%% of nominal clock' % (p['thermal']['cpu_temp_c'], p['thermal']['cpu_perf_pct']))
print('       gpu    : %s (%s)' % (p['gpu']['name'], p['gpu']['status']))
"
else
  bad "probe did not emit valid JSON — run ./tools/hw/verify_compute.sh generic and read the output"
  exit 1
fi

# ── 6. what can actually run right now ──────────────────────────────────
say "6. Workload classes"
python3 tools/hw/evaluate_gate.py --all --dry-run --probe "$PROBE_OUT" 2>&1 | sed 's/^/ /'

say "Next"
cat <<'NEXT'
  · python3 tools/verify_system.py        protocol integrity (must exit 0)
  · Author at least one context/brand/*.context.md, or write a Content MD into vault/.
    Until then every route resolves at L3 and parks — by design, not by failure.
    See BOOT.md § "Why it still says BLOCKED".
NEXT
echo
