# CustomerSAX — Deployment Guide

> **Last updated:** August 2026  
> **Branch:** `customerSAX-Prod`  
> **Project:** `customerservice-505511` (GCP) · `amahaveers-projects` (Vercel)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Live URLs](#2-live-urls)
3. [CI/CD Pipeline](#3-cicd-pipeline)
4. [GitHub Secrets Required](#4-github-secrets-required)
5. [GCP Cloud Run Services](#5-gcp-cloud-run-services)
6. [Vercel Frontend Apps](#6-vercel-frontend-apps)
7. [Infrastructure (Terraform)](#7-infrastructure-terraform)
8. [Domain & DNS Setup](#8-domain--dns-setup)
9. [Local Development](#9-local-development)
10. [Runbooks](#10-runbooks)
11. [Adding a New Service](#11-adding-a-new-service)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS / BROWSER                          │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
               ▼                             ▼
  ┌────────────────────────┐   ┌─────────────────────────────┐
  │  studio.customersax.com│   │   www.customersax.com        │
  │  (Vercel — Next.js)    │   │   (Vercel — Next.js 16)      │
  │  apps/studio           │   │   apps/marketing             │
  └───────────┬────────────┘   └─────────────────────────────┘
              │ GraphQL / REST
              ▼
  ┌─────────────────────────────────────────────────────────┐
  │  BFF — csa-dev-bff  [PUBLIC]                            │
  │  Apollo Federation Gateway                              │
  │  https://csa-dev-bff-v3egj3ywmq-uc.a.run.app           │
  └──────┬───────────┬──────────┬──────────┬───────────────┘
         │           │          │          │
         ▼           ▼          ▼          ▼
  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────────────┐
  │  auth    │ │ticketing │ │ai-    │ │ commerce-*        │
  │ [PUBLIC] │ │[PRIVATE] │ │assist │ │ (4 adapters)      │
  │          │ │          │ │[PRIV] │ │ [PRIVATE]         │
  └──────────┘ └──────────┘ └───────┘ └──────────────────┘
              All on Google Cloud Run (us-central1)
```

### Service Roles

| Service | Visibility | Role |
|---|---|---|
| **bff** | 🌐 Public | Apollo Federation gateway — single entry point for the frontend |
| **auth** | 🌐 Public | Authentication & JWT issuing — users log in here directly |
| **ai-assist** | 🔒 Private | LLM orchestration — called from BFF only |
| **ticketing** | 🔒 Private | MongoDB-backed ticket subgraph — called from BFF |
| **admin** | 🔒 Private | Admin management subgraph — called from BFF |
| **commerce-commercetools** | 🔒 Private | CommerceTools adapter subgraph |
| **commerce-shopify** | 🔒 Private | Shopify adapter subgraph (placeholder) |
| **commerce-bigcommerce** | 🔒 Private | BigCommerce adapter subgraph (placeholder) |
| **commerce-sfcc** | 🔒 Private | Salesforce Commerce Cloud adapter subgraph |

---

## 2. Live URLs

### Frontend (Vercel)

| App | Custom Domain | Vercel URL |
|---|---|---|
| **Backoffice / Studio** | https://studio.customersax.com | https://customersax-studio.vercel.app |
| **Marketing Site** | https://www.customersax.com | https://customersax-marketing.vercel.app |

### Backend (GCP Cloud Run)

| Service | URL | Access |
|---|---|---|
| **bff** | https://csa-dev-bff-v3egj3ywmq-uc.a.run.app | 🌐 Public |
| **auth** | https://csa-dev-auth-v3egj3ywmq-uc.a.run.app | 🌐 Public |
| **ai-assist** | https://csa-dev-ai-assist-v3egj3ywmq-uc.a.run.app | 🔒 Private |
| **ticketing** | https://csa-dev-ticketing-v3egj3ywmq-uc.a.run.app | 🔒 Private |
| **admin** | https://csa-dev-admin-v3egj3ywmq-uc.a.run.app | 🔒 Private |

---

## 3. CI/CD Pipeline

**Trigger:** Every push to `customerSAX-Prod` branch runs the full pipeline automatically.

```
push → customerSAX-Prod
         │
         ▼
 ┌─────────────────────────────────────┐
 │ Job 1: 🌱 Bootstrap (45s)           │
 │  - Ensures all 9 Cloud Run services │
 │    exist (idempotent)               │
 │  - bff + auth: --allow-unauth       │
 │  - others: --no-allow-unauth        │
 │  - grants allUsers IAM on bff+auth  │
 └──────────────┬──────────────────────┘
                │
                ▼
 ┌─────────────────────────────────────┐
 │ Job 2: 🏗️ Terraform (21s)           │
 │  - terraform apply (no plan needed) │
 │  - Manages IAM, secrets, services   │
 └──────────────┬──────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
 ┌────────────┐  ┌───────────────────────────┐
 │ Job 3:     │  │ Job 4:                     │
 │ 🌐 Vercel  │  │ 🚀 Cloud Build (4min)      │
 │  (2m38s)   │  │  - Detects changed svc     │
 │  studio    │  │    via git diff             │
 │  marketing │  │  - Builds Docker images    │
 └────────────┘  │  - Deploys to Cloud Run    │
                 └───────────────────────────┘
                         │
                         ▼
                 ┌────────────────────┐
                 │ Job 5: 📋 Summary  │
                 │  Prints all URLs   │
                 └────────────────────┘
```

**Total pipeline time: ~8 minutes**

### Files

| File | Purpose |
|---|---|
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | GitHub Actions pipeline definition |
| [`cloudbuild.yaml`](cloudbuild.yaml) | GCP Cloud Build steps |

---

## 4. GitHub Secrets Required

Configure at: `https://github.com/CustomerSAX/customerSAX/settings/secrets/actions`

| Secret | Description | How to get |
|---|---|---|
| `GCP_CREDENTIALS` | GCP service account JSON key | IAM → Service Accounts → Keys → Create |
| `VERCEL_TOKEN` | Vercel personal access token | vercel.com → Account → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel team/org ID | `vercel teams ls` |
| `VERCEL_PROJECT_ID_STUDIO` | Project ID for `customersax-studio` | `vercel project ls` |
| `VERCEL_PROJECT_ID_MARKETING` | Project ID for `customersax-marketing` | `vercel project ls` |
| `VERCEL_PROJECT_ID_DOCS` | Project ID for docs-site | `vercel project ls` |

### GCP Service Account Required Roles

```
roles/run.admin                           # Deploy + manage Cloud Run
roles/iam.serviceAccountUser              # Run as service accounts
roles/secretmanager.admin                 # Manage secrets
roles/cloudbuild.builds.editor            # Trigger Cloud Build
roles/artifactregistry.writer             # Push Docker images
roles/resourcemanager.projectIamAdmin     # Grant allUsers IAM on services
roles/storage.objectViewer                # Read build artifacts
```

---

## 5. GCP Cloud Run Services

### Project Details

| Field | Value |
|---|---|
| **Project ID** | `customerservice-505511` |
| **Region** | `us-central1` |
| **Artifact Registry** | `us-central1-docker.pkg.dev/customerservice-505511/csa-dev-repo` |

### Service Naming Convention

All services: `csa-{environment}-{service-name}` (e.g. `csa-dev-bff`)

### Managing Public/Private Access

**Make a service public:**
```bash
gcloud run services add-iam-policy-binding csa-dev-SERVICE \
  --region=us-central1 \
  --project=customerservice-505511 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

**Make a service private:**
```bash
gcloud run services remove-iam-policy-binding csa-dev-SERVICE \
  --region=us-central1 \
  --project=customerservice-505511 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

> Or update `infra/gcp/main.tf` with a `google_cloud_run_v2_service_iam_member` resource and push.

### Check All Service URLs

```bash
for SVC in bff auth ai-assist commerce-commercetools ticketing admin; do
  URL=$(gcloud run services describe "csa-dev-${SVC}" \
    --region=us-central1 --project=customerservice-505511 \
    --format='value(status.url)' 2>/dev/null || echo "not found")
  echo "  ${SVC}: ${URL}"
done
```

---

## 6. Vercel Frontend Apps

### Project Structure

```
apps/
├── studio/          → studio.customersax.com  (Next.js 14, pnpm monorepo)
└── marketing/       → www.customersax.com     (Next.js 16, standalone npm)
```

### Build Configuration

**studio** — `vercel.json` (repo root):
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm --filter @csa/studio build",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/studio/.next"
}
```

**marketing** — `apps/marketing/vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install"
}
```

### Key Vercel Environment Variables (set in Vercel dashboard)

| Variable | Value | App |
|---|---|---|
| `NEXT_PUBLIC_BFF_URL` | `https://csa-dev-bff-v3egj3ywmq-uc.a.run.app` | studio |
| `NEXT_PUBLIC_ENV` | `production` | studio |
| `NEXTAUTH_URL` | `https://studio.customersax.com` | studio |
| `NEXTAUTH_SECRET` | (generate with `openssl rand -base64 32`) | studio |

---

## 7. Infrastructure (Terraform)

### File Layout

```
infra/gcp/
├── main.tf          # Cloud Run services, IAM, secrets, Cloud SQL
├── variables.tf     # Input variables
├── imports.tf       # Import blocks for existing resources
├── locals.tf        # Name prefix + computed locals
└── providers.tf     # Google provider + required_providers
```

### Running Locally

```bash
cd infra/gcp

terraform init

terraform plan \
  -var="project_id=customerservice-505511" \
  -var="project_number=17754871169" \
  -var="region=us-central1" \
  -var="environment=dev"

terraform apply \
  -var="project_id=customerservice-505511" \
  -var="project_number=17754871169" \
  -var="region=us-central1" \
  -var="environment=dev"
```

### Key Resources Managed

| Resource | Count | Description |
|---|---|---|
| `google_cloud_run_v2_service` | 9 | All Cloud Run services |
| `google_cloud_run_v2_service_iam_member` | 2 | Public IAM for bff + auth |
| `google_project_service` | 6 | Enabled GCP APIs |
| `google_secret_manager_secret` | 3 | Application secrets |

---

## 8. Domain & DNS Setup

### Registrar / Nameservers

`customersax.com` → third-party registrar → **Vercel nameservers**:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

### DNS Records (Vercel-managed)

| Name | Type | Value | Destination |
|---|---|---|---|
| `studio` | CNAME | `81848bce506ce416.vercel-dns-017.com` | Backoffice (studio) |
| `www` | CNAME | `cname.vercel-dns.com` | Marketing site |
| `*` | ALIAS | `cname.vercel-dns-017.com` | Wildcard fallback |
| `@` (apex) | ALIAS | `301bfcf04886a174.vercel-dns-017.com` | Apex → www redirect |

### Adding a New Subdomain

```bash
# 1. Attach domain to Vercel project
vercel domains add api.customersax.com customersax-studio --scope amahaveers-projects

# 2. Add DNS record (use the CNAME shown in Vercel dashboard)
vercel dns add customersax.com api CNAME <hash>.vercel-dns-017.com --scope amahaveers-projects

# 3. Test
curl -I https://api.customersax.com
```

---

## 9. Local Development

### Prerequisites

```bash
node --version   # >= 20
pnpm --version   # 9.6.0 (npm install -g pnpm@9.6.0)
docker --version # for container builds
```

### First-time Setup

```bash
git clone https://github.com/CustomerSAX/customerSAX.git
cd customerSAX
git checkout customerSAX-Prod
pnpm install

# Copy env files for each service
cp apps/bff/.env.example          apps/bff/.env
cp apps/auth/.env.example         apps/auth/.env
cp apps/ticketing/.env.example    apps/ticketing/.env
cp apps/ai-assist/.env.example    apps/ai-assist/.env
```

### Running Services

```bash
# All services in parallel (recommended)
pnpm dev

# Individual
pnpm app:studio                   # http://localhost:3000
pnpm app:bff                      # http://localhost:4000/graphql
pnpm app:commerce-commercetools   # http://localhost:4310/graphql
pnpm app:ticketing                # http://localhost:4350/graphql
pnpm app:ai-assist                # http://localhost:8080/assist
```

### Port Map

| Service | Port |
|---|---|
| studio | 3000 |
| bff | 4000 |
| auth | 4100 |
| admin | 4200 |
| commerce-commercetools | 4310 |
| commerce-shopify | 4320 |
| commerce-bigcommerce | 4330 |
| commerce-sfcc | 4340 |
| ticketing | 4350 |
| ai-assist | 8080 |

---

## 10. Runbooks

### 🔴 Cloud Run service returns 403

**For bff or auth (should be public):**
```bash
gcloud run services add-iam-policy-binding csa-dev-bff \
  --region=us-central1 --project=customerservice-505511 \
  --member="allUsers" --role="roles/run.invoker"
```

**For private services:** 403 is correct — services should only be called from BFF using service-to-service auth.

---

### 🔴 Vercel build fails

```bash
# Get exact error
gh run view <RUN_ID> --repo CustomerSAX/customerSAX --job <JOB_ID> --log-failed

# Common fixes:
# 1. pnpm version mismatch → check packageManager in package.json
# 2. Missing env var → add in Vercel project settings
# 3. Build command wrong → check vercel.json buildCommand
```

---

### 🔴 Terraform fails on Terraform Apply

```bash
cd infra/gcp

# See what Terraform thinks the state is
terraform state list

# If a resource drifted, re-import it
terraform import google_cloud_run_v2_service.bff \
  "projects/customerservice-505511/locations/us-central1/services/csa-dev-bff"

# Then plan again
terraform plan -var="project_id=customerservice-505511" -var="region=us-central1" ...
```

---

### 🟡 Check all services health

```bash
BASE="v3egj3ywmq-uc.a.run.app"
echo "=== Cloud Run Services ==="
for SVC in bff auth ai-assist ticketing admin; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://csa-dev-${SVC}-${BASE}")
  EXPECTED=$([[ "$SVC" == "bff" || "$SVC" == "auth" ]] && echo "200" || echo "403")
  STATUS=$([[ "$CODE" == "$EXPECTED" ]] && echo "✅" || echo "❌")
  echo "  ${STATUS} ${SVC}: HTTP ${CODE} (expected ${EXPECTED})"
done

echo ""
echo "=== Vercel Frontend ==="
for URL in "https://studio.customersax.com" "https://www.customersax.com"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL")
  echo "  $([[ $CODE == 200 ]] && echo ✅ || echo ❌) ${URL}: HTTP ${CODE}"
done
```

---

### 🟡 Adding a secret to Secret Manager

```bash
# Create
echo -n "my-secret-value" | gcloud secrets create MY_SECRET_NAME \
  --data-file=- --project=customerservice-505511

# Grant access to Cloud Run SA
gcloud secrets add-iam-policy-binding MY_SECRET_NAME \
  --project=customerservice-505511 \
  --member="serviceAccount:SA@customerservice-505511.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### 🟡 Rollback a service

```bash
# List recent revisions
gcloud run revisions list \
  --service=csa-dev-bff \
  --region=us-central1 \
  --project=customerservice-505511

# Roll back to a specific revision
gcloud run services update-traffic csa-dev-bff \
  --region=us-central1 \
  --project=customerservice-505511 \
  --to-revisions=csa-dev-bff-00010-abc=100
```

---

## 11. Adding a New Service

### Step 1 — Create the App

```bash
mkdir apps/my-service
# Add: Dockerfile, package.json, src/index.ts
```

### Step 2 — Add Terraform Resource

In `infra/gcp/main.tf`:

```hcl
resource "google_cloud_run_v2_service" "my_service" {
  name     = "${local.name_prefix}-my-service"
  location = var.region

  template {
    containers {
      image = var.my_service_image
    }
  }

  lifecycle { ignore_changes = [template] }
  depends_on = [google_project_service.required]
}

# Add if PUBLIC:
resource "google_cloud_run_v2_service_iam_member" "my_service_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.my_service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

### Step 3 — Add Import Block

In `infra/gcp/imports.tf`:

```hcl
import {
  id = "projects/${var.project_id}/locations/${var.region}/services/csa-dev-my-service"
  to = google_cloud_run_v2_service.my_service
}
```

### Step 4 — Add to Bootstrap Workflow

In `.github/workflows/deploy.yml`, add `csa-dev-my-service` to `PUBLIC_SERVICES` or `PRIVATE_SERVICES`.

### Step 5 — Push

```bash
git add .
git commit -m "feat: add my-service to platform"
git push origin customerSAX-Prod
# Pipeline runs in ~8 minutes
```

---

## Quick Reference Cheatsheet

```bash
# ─── Deploy ──────────────────────────────────────────────
git push origin customerSAX-Prod              # triggers full pipeline

# ─── Monitor ─────────────────────────────────────────────
gh run list --repo CustomerSAX/customerSAX --limit 5
gh run watch <RUN_ID> --repo CustomerSAX/customerSAX

# ─── URLs ────────────────────────────────────────────────
open https://studio.customersax.com           # backoffice
open https://www.customersax.com              # marketing
open https://csa-dev-bff-v3egj3ywmq-uc.a.run.app/graphql  # BFF

# ─── GCP ─────────────────────────────────────────────────
gcloud run services list --region=us-central1 --project=customerservice-505511
gcloud run revisions list --service=csa-dev-bff --region=us-central1 --project=customerservice-505511

# ─── Vercel ──────────────────────────────────────────────
vercel project ls --scope amahaveers-projects
vercel domains ls --scope amahaveers-projects
vercel dns ls customersax.com --scope amahaveers-projects

# ─── Terraform ───────────────────────────────────────────
cd infra/gcp && terraform state list
```
