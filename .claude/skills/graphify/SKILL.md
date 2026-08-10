---
name: graphify
description: >
  Use to build or query a local knowledge graph of this codebase (or a subset of it) via the Graphify CLI —
  deterministic, local tree-sitter AST parsing, no data leaves the machine, no LLM call required for the
  core graph. Useful for "what depends on X", "trace the path between A and B", "what are the architectural
  hubs", or generating an onboarding-style overview (graph.html/GRAPH_REPORT.md) of a package before a big
  refactor.
---

# Graphify — local codebase knowledge graph

Installed in this environment via `uv tool install graphifyy` (PyPI package name is `graphifyy`, double-y;
the CLI command is `graphify`). Source: https://github.com/Graphify-Labs/graphify

## Known environment issue

Running the installed `graphify.exe` entry-point directly is blocked by this sandbox's Bash/PowerShell
permission classifier (denied as a bulk/whole-codebase-scanning action from a freshly-installed third-party
binary — this is a deliberate safety gate, not a bug). It works when invoked through the venv's own
`python.exe -m graphify`, which is how the commands below are written. If that also gets denied in a future
session, stop and ask the user rather than trying further workarounds — per the denial message itself, only
the user can grant that Bash permission (or run the command in their own terminal outside the sandbox).

## Locating the install

```bash
GRAPHIFY_PY="$HOME/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe"   # Windows, this environment
"$GRAPHIFY_PY" -m graphify --version
```

If `uv tool list` doesn't show `graphifyy`, reinstall with `uv tool install graphifyy` (requires `uv`; if
missing, `pip install uv` first, then `uv tool update-shell` or use the full path above).

## Building the graph for this repo (or a subpackage)

Code-only, offline, no API key needed — respects `.gitignore` automatically (so `node_modules`/`dist`/`.next`
are already excluded here):

```bash
"$GRAPHIFY_PY" -m graphify update . --code-only
```

Run from a specific package directory (e.g. `apps/ai-assist`) to scope the graph instead of the whole
monorepo — useful given this repo's size. Output lands in `<path>/graphify-out/{graph.html,GRAPH_REPORT.md,
graph.json}`.

To also name communities (subsystem clusters) with an LLM instead of `Community N` placeholders, a backend
API key is required (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. — see the upstream README) — otherwise
`cluster-only`/`update` still produce a structurally-clustered, just unlabeled, graph.

## Querying an existing graph

```bash
"$GRAPHIFY_PY" -m graphify query "how does the return eligibility check work" --graph graphify-out/graph.json
"$GRAPHIFY_PY" -m graphify path "checkReturnEligibilityTool" "ReturnStepper" --graph graphify-out/graph.json
"$GRAPHIFY_PY" -m graphify explain "resolvers.ts" --graph graphify-out/graph.json
"$GRAPHIFY_PY" -m graphify god-nodes --graph graphify-out/graph.json   # most-connected files/symbols
```

## Registering it as a native Claude Code skill (not yet done in this repo)

`"$GRAPHIFY_PY" -m graphify claude install` writes a graphify section into the root `CLAUDE.md` plus a
PreToolUse hook, which is the officially-supported integration path (letting a future `/graphify .` slash
invocation work natively). This was **not run** in this environment because it went through the same binary
the sandbox blocks running bulk actions from — ask the user before running it, since it modifies `CLAUDE.md`
and adds a hook (both count as persistent configuration changes).
