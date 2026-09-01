# tools/ui-ux-pro-max — vendored payload

Search engine and databases for `skills/ui_ux_intelligence.skill.md`. This is a
**vendored copy**, not a submodule and not a symlink — the Router must be able to
run a routed skill with no network and no path outside the repository.

| | |
|---|---|
| Upstream | `nextlevelbuilder/ui-ux-pro-max-skill` |
| Vendored from | `src/ui-ux-pro-max/{data,scripts}` |
| Upstream version | 2.13.0 |
| License | MIT |
| Files | 44 |
| Size | 3.11 MB |
| Payload sha256 | `8c9f75279bf03708e6c9035d3295ce0e326c78ab3eddc82b757ad8e5e4656f98` |

Excluded from the copy: `scripts/tests/`, `__pycache__/`, `*.pyc`. Everything the
twelve search domains and the design-system generator read is present; nothing was
trimmed from `data/`.

## Line endings

The payload is kept **byte-identical to upstream (LF)**, unlike the CRLF used by
hand-authored files in this repository. That is deliberate: it makes the sha256
above comparable against an upstream checkout, so a re-vendor can be verified
rather than trusted. Do not normalize these files.

## Re-vendoring

```bash
SRC=<path-to-upstream>/src/ui-ux-pro-max
rm -rf tools/ui-ux-pro-max/{data,scripts}
cp -r "$SRC/data" "$SRC/scripts" tools/ui-ux-pro-max/
rm -rf tools/ui-ux-pro-max/scripts/tests
find tools/ui-ux-pro-max -name __pycache__ -type d -exec rm -rf {} +
```

Then recompute the hash above and re-run `python3 tools/verify_system.py`.

## Local edits

**None.** Every file matches upstream. If a fix is needed, fix it upstream and
re-vendor — a local patch here is invisible to the hash and will be silently
overwritten by the next re-vendor.
