#!/usr/bin/env python3
"""
vault_manifest.py -- lightweight index of a vault for the hub UI.

state/rag_index/index.json exists for retrieval and carries embeddings, which
makes it enormous and unfit for a browser to fetch. This writes the small
sibling a static page can actually load: one row per note, nothing else.

    python3 tools/vault_manifest.py                    # this repo's vault/
    python3 tools/vault_manifest.py --vault ../Creative-Writing

Handles two note shapes:

- **Content MD** (vault/SCHEMA.md): YAML frontmatter with kind/status/etc.,
  an authored `## Overview` section. Read verbatim.
- **Plain markdown** (e.g. a Creative-Writing-style archive with no
  frontmatter): title comes from the first `# ` heading, the overview from
  a leading `**Type:** ...` / `**Note:** ...` metadata block if present,
  falling back to the first real paragraph. Kind comes from the top-level
  folder name. Dates come from file mtime, since there's no frontmatter to
  carry them.

Re-run after adding or editing notes -- hub/index.html reads the JSON this
writes, it does not read the vault directly. Stdlib only.
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "state"
OUT_FILE = STATE / "vault_manifest.json"

FRONTMATTER_FIELDS = (
    "id", "title", "kind", "project", "status", "created", "updated", "tags",
)

EXCLUDED_NAMES = ("SCHEMA.md", "README.md", "00_INDEX.md")

OVERVIEW_EXCERPT_CHARS = 400


def vault_files(vault: Path):
    """Same rule as vault_rag.py's vault_files: underscore/dot dirs and the
    vault's own docs are scaffolding, not corpus. Keep the two in sync,
    except EXCLUDED_NAMES which is manifest-only -- an index/TOC page like
    00_INDEX.md is still worth embedding for search, just not worth a card."""
    out = []
    for f in sorted(vault.rglob("*.md")):
        rel = f.relative_to(vault)
        if any(p.startswith("_") or p.startswith(".") for p in rel.parts[:-1]):
            continue
        if rel.name in EXCLUDED_NAMES:
            continue
        out.append(f)
    return out


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm, body = text[3:end], text[end + 4:]
    meta = {}
    for line in fm.splitlines():
        m = re.match(r"^(\w[\w_]*):\s*(.*)$", line)
        if not m or m.group(1) not in FRONTMATTER_FIELDS:
            continue
        key, val = m.group(1), m.group(2).strip()
        if key == "tags":
            val = [t.strip() for t in val.strip("[]").split(",") if t.strip()]
        else:
            val = val.strip('"\'')
        meta[key] = val
    return meta, body


def extract_section(body, name):
    m = re.search(rf"^##\s+{re.escape(name)}\s*$(.*?)(?=^##\s|\Z)", body,
                   re.MULTILINE | re.DOTALL)
    return m.group(1).strip() if m else ""


def extract_h1_title(body):
    m = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    return m.group(1).strip() if m else ""


def extract_bold_meta_blurb(body):
    """Pull '**Label:** value' lines from a leading metadata block (this is
    the Creative-Writing archive's own convention -- Type/Source/Note) and
    join the descriptive ones into a short blurb."""
    head = body.split("\n---", 1)[0]
    parts = []
    for label in ("Type", "Note"):
        m = re.search(rf"\*\*{label}:\*\*\s*(.+)", head)
        if m:
            parts.append(m.group(1).strip())
    return " — ".join(parts)


def extract_first_paragraph(body, after_marker="\n---"):
    text = body
    if after_marker in text:
        text = text.split(after_marker, 1)[1]
    text = re.sub(r"^#.*$", "", text, flags=re.MULTILINE)  # drop stray headings
    for para in re.split(r"\n\s*\n", text):
        cleaned = " ".join(para.split())
        if len(cleaned) > 20:
            return (cleaned[:OVERVIEW_EXCERPT_CHARS] + "…") if len(cleaned) > OVERVIEW_EXCERPT_CHARS else cleaned
    return ""


def kind_from_folder(vault: Path, f: Path):
    rel_parts = f.relative_to(vault).parts
    if len(rel_parts) < 2:
        return "other"
    return re.sub(r"^\d+[_-]?", "", rel_parts[0]).replace("_", " ").strip() or "other"


def build(vault: Path):
    notes = []
    for f in vault_files(vault):
        raw = f.read_text(encoding="utf-8", errors="replace")
        meta, body = parse_frontmatter(raw)
        rel = str(f.relative_to(vault)).replace("\\", "/")
        is_content_md = bool(meta)

        if is_content_md:
            title = meta.get("title") or re.sub(r"[_-]", " ", f.stem)
            kind = meta.get("kind", "other")
            overview = extract_section(body, "Overview")
            next_steps = extract_section(body, "Next Steps")
            next_steps_open = len(re.findall(r"^- \[ \]", next_steps, re.MULTILINE))
            created, updated = meta.get("created", ""), meta.get("updated", "")
        else:
            title = extract_h1_title(body) or re.sub(r"[_-]", " ", f.stem)
            kind = kind_from_folder(vault, f)
            overview = extract_bold_meta_blurb(body) or extract_first_paragraph(body)
            next_steps_open = 0
            mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")
            created, updated = mtime, mtime

        notes.append({
            "path": rel,
            "id": meta.get("id", ""),
            "title": title,
            "kind": kind,
            "status": meta.get("status", ""),
            "project": meta.get("project", ""),
            "tags": meta.get("tags", []),
            "created": created,
            "updated": updated,
            # Full body, not just the excerpt below -- the hub's AI overview
            # and Ask-tab indexing need the whole note, and the vault this
            # came from is often outside the static server's own root (e.g.
            # a sibling directory), so there is no URL the browser could
            # fetch it back from. Embedding it here is what makes the
            # manifest work regardless of where the vault actually lives.
            "body": body.strip(),
            "overview": overview,
            "next_steps_open": next_steps_open,
            "content_hash": hashlib.sha256(raw.encode()).hexdigest()[:16],
            "word_count": len(body.split()),
        })
    notes.sort(key=lambda n: n["updated"] or n["created"], reverse=True)
    return notes


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vault", default=str(ROOT / "vault"))
    ap.add_argument("--out", default=str(OUT_FILE))
    args = ap.parse_args()

    vault = Path(args.vault).resolve()
    if not vault.is_dir():
        print(f"  no vault at {vault}", file=sys.stderr)
        return 1

    notes = build(vault)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "vault": str(vault),
        "built": datetime.now(timezone.utc).isoformat(),
        "count": len(notes),
        "notes": notes,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"  vault  {vault}")
    print(f"  notes  {len(notes)}")
    print(f"  wrote  {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    return 0


if __name__ == "__main__":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")
        except (AttributeError, OSError):
            pass
    sys.exit(main())
