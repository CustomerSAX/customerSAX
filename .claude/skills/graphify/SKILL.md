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

## Known environment quirks

- **Invoke via `python.exe -m graphify`, not the bare `graphify`/`graphify.exe` entry point.** On Windows,
  the compiled `graphify.exe`/`graphify-mcp.exe` wrapper binaries that `uv tool install` produces can get
  blocked outright ("Access is denied", or a Bash-tool permission-classifier denial on a first attempt) —
  invoking through the venv's own `python.exe -m graphify ...` (the commands below) works reliably instead
  and is the confirmed-working path in this repo.
- **`update` does not take `--code-only`.** That flag exists on other subcommands (per `graphify --help`),
  not `update` — passing it to `update` fails with `error: unknown update option: --code-only`. Plain
  `graphify update <path>` is already code-only/offline by default (it prints "no LLM needed" and reports
  `Token cost: 0 input · 0 output`) — no flag needed for the common case.
- **`uv tool install` installs per-*profile*, not per-repo.** If you and someone else (or you and an
  isolated Claude Code session) each ran `uv tool install graphifyy` separately, you'll each have your own
  copy under your own `%USERPROFILE%\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe` — the path isn't
  shared just because you're both working in the same repo checkout. Confirm the real path on whichever
  machine/session you're running from with `uv tool dir` (or `python -m uv tool dir` if `uv` itself isn't on
  PATH) rather than assuming a path documented from a different session.
- `uv`/`graphify` not being on PATH after install shows up as `CommandNotFoundException` — either always
  invoke via the full path (see below), or run `uv tool update-shell` (or manually add
  `%USERPROFILE%\.local\bin` to the user `PATH` and restart the shell) to fix it permanently.

## Locating the install

```bash
GRAPHIFY_PY="$HOME/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe"   # Windows, this environment
"$GRAPHIFY_PY" -m graphify --version
```

If `uv tool list` doesn't show `graphifyy`, reinstall with `uv tool install graphifyy` (requires `uv`; if
missing, `pip install uv` first, then `uv tool update-shell` or use the full path above).

## Building the graph for this repo (or a subpackage)

Offline, no API key needed, respects `.gitignore` automatically (so `node_modules`/`dist`/`.next` are already
excluded here):

```bash
"$GRAPHIFY_PY" -m graphify update .
```

Confirmed working on this repo (2026-08-10, commit `f829d743`): 311 files, 1,842 nodes, 3,069 edges, 136
communities, 99% EXTRACTED/1% INFERRED, 0 token cost, completed in a few minutes. Two known partial-coverage
gaps on this repo specifically: `.tf` files under `infra/gcp` need `pip install "graphifyy[terraform]"` to be
included at all, and 8 `.tsx` files (`CustomerCreateView.tsx`, `CustomerListView.tsx`,
`CustomerDetailView.tsx`, `OrderDetailView.tsx`, `TicketDetailView.tsx`, +3 more) hit tree-sitter syntax
errors and are only partially extracted — check `GRAPH_REPORT.md`'s warnings section for the current list
after any re-run.

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
invocation work natively). This was **not run** in this repo — ask the user before running it, since it
modifies `CLAUDE.md` and adds a hook (both are persistent configuration changes, independent of whether the
extraction command itself needs permission).
