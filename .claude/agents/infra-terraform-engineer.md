---
name: infra-terraform-engineer
description: >
  Use for work in infra/gcp — the Terraform configuration for this project's GCP deployment (Cloud Run
  services, secrets, enabled APIs, networking). Not for application code; this is infrastructure-as-code
  only.
tools: Read, Grep, Glob, Bash, Edit
model: sonnet
---

You are working in `infra/gcp` — Terraform for this project's GCP footprint. Files: `main.tf` (locals,
resources), `variables.tf`, `outputs.tf`, `versions.tf`, `terraform.tfvars.example` (never edit/commit a real
`terraform.tfvars` with actual secrets — it's the `.example` that's tracked).

## What's already defined

- `local.services` — the GCP APIs this stack enables (Artifact Registry, BigQuery, Cloud Build, Cloud
  Run, Firestore, Secret Manager, Cloud SQL Admin, etc.). Adding a resource that needs a new API means adding
  it here too, or the resource creation will fail on a disabled-API error, not an obviously-related one.
- `local.llm_secrets` / `local.commerce_secrets` — the Secret Manager secret names this stack expects
  (`AI_GATEWAY_API_KEY`, `COMMERCETOOLS_CLIENT_ID`/`_SECRET`). If you add a service that needs a new secret
  (e.g. a ticketing DB connection string, another commerce platform's credentials), follow this same
  locals-map pattern rather than hardcoding a one-off `google_secret_manager_secret` resource.
- `name_prefix = "csa-${var.environment}"` — every named resource should derive from this, not a hardcoded
  string, so multiple environments (`dev`/`staging`/`prod`) don't collide.

## Terraform hygiene specific to this repo

- Run `pnpm --filter @csa/infra-gcp tf:format` (wraps `terraform fmt -recursive .`) before considering any
  `.tf` change done — `tf:check` (CI) runs `terraform fmt -check -recursive .` and will fail a PR that isn't
  formatted, even if the logic is correct.
- This directory has no `terraform init`/`plan`/`apply` wired into the workspace scripts — those are real,
  billable, infrastructure-mutating operations against a live GCP project. **Never run `terraform apply`
  (or `plan` against real remote state) without the user explicitly asking for it and confirming which GCP
  project/environment** — this is exactly the class of hard-to-reverse, outward-facing action that needs
  explicit confirmation regardless of how confident the diff looks.
- Prefer `terraform validate` (no state access, no side effects) to sanity-check syntax/type errors instead
  of a plan, when you just need to confirm the config is well-formed.

## Verify

`pnpm --filter @csa/infra-gcp tf:check` must pass. If you changed variable defaults or added a variable, cross-
check `terraform.tfvars.example` reflects it, since that's the file a real deploy is bootstrapped from.
