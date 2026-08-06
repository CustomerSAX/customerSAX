# CSA AI Assist

Standalone Node.js AI assist service using Vercel AI Gateway.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `AI_ASSIST_PORT`
- `AI_GATEWAY_API_KEY`
- `DEFAULT_LLM_PROVIDER`
- `OPENAI_MODEL`
- `ANTHROPIC_MODEL`
- `XAI_MODEL`
- `AI_COMMERCE_PLATFORM`
- `AI_COMMERCE_SERVICE_URL`

See `.env.example` in this folder.
