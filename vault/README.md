# vault/

The Obsidian vault. **This is the source of truth for creative work** — not the
database. Open this directory as a vault in Obsidian and edit freely; the archive
indexes these files for search and the graph view, and never owns them.

That direction matters: a Content MD stays readable, diffable, and portable
whether or not any part of this system is running. If the archive is down, the
work is still there in plain markdown. If you stop using this system entirely, you
keep everything.

## What's here

| Path | |
|---|---|
| `SCHEMA.md` | The Content MD spec. Read this first. |
| `_templates/content-md.md` | Obsidian template — point core Templates or Templater at `_templates/` |
| `_examples/` | A worked example. Safe to delete once you have real notes. |
| `<project>/<kind>/` | Your actual Content MDs |

Directories prefixed `_` are ignored by ingest.

## Why Content MDs exist

No session state survives between tasks by design. When you or an agent returns to
a project, the Content MD *is* the memory — read cold, it has to be enough to
resume. That constraint is what keeps the notes honest: anything the file doesn't
say is genuinely lost, so the file says it.

Over time the vault also becomes the corpus this system learns your work from.
Past Content MDs are precedent — how you actually made things, what you decided,
what you rejected — and that is what the archive matches against when grounding a
new task.

## Setup

1. Open this directory as an Obsidian vault
2. Settings → Files and links → set template folder to `_templates`
3. Optional: install Dataview to query across notes, e.g. everything in progress:

````
```dataview
TABLE kind, project, updated
FROM "vault"
WHERE type = "content-md" AND status = "in-progress"
SORT updated DESC
```
````
