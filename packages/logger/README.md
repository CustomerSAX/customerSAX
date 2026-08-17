# @csa/logger

Shared structured logging for CSA backend services. Winston under the hood,
a small stable facade on top, and a native `AsyncLocalStorage` request context
so a correlation id (and tenant/user identity) rides along on every log line
without being threaded through function signatures.

Source-ESM, exactly like `@csa/mongodb`: the package `main`/`exports` point at
`./src/*.ts` and services run it through `tsx`. No build step is required for
development.

## Usage

```ts
import { createLogger } from "@csa/logger";

const log = createLogger("auth");
log.info("service ready", { port: 4360 });

const authLog = log.child({ module: "auth" });
authLog.info("active project changed", { userId, projectKey, clientId });

try {
  // ...
} catch (err) {
  log.error("login failed", err, { projectKey }); // err is the 2nd arg
}
```

### Request context at the edge

Pick the helper that matches the server shape:

```ts
// node:http (auth)
import { withHttpContext } from "@csa/logger";
const server = createServer(withHttpContext(log, async (req, res) => { ... }));

// Express (ai-assist)
import { expressContext } from "@csa/logger";
app.use(express.json());
app.use(expressContext(log));

// Apollo subgraph / gateway
import { apolloContext, apolloLoggingPlugin } from "@csa/logger";
new ApolloServer({ schema, plugins: [apolloLoggingPlugin(log)] });
startStandaloneServer(server, {
  context: async ({ req }) => apolloContext(req),
});
```

Each helper reads an inbound `x-request-id` (or generates one) and echoes /
forwards it, so a correlation id set at the studio/BFF edge survives every hop.

## API

- `createLogger(service, base?) → Logger` — `{ debug, info, warn, error(msg, err?, meta?), child(bindings) }`.
- Context: `runWithContext`, `enterContext`, `getContext`, `getRequestId`, `newRequestId`, `runAsSystem`.
- Edge: `withHttpContext`, `expressContext`, `apolloContext`, `apolloLoggingPlugin`, `REQUEST_ID_HEADER`.
- PII-safety: `describe(v) → { type, size }` (never the value), `safeMeta(meta)` (allowlist filter).

## Client shim

`@csa/logger/client` exposes the same `Logger` shape backed by `console`, with
no Winston / Node imports — safe to import into studio client components.

## PII-safety

- `userEmail` may live in the request context (for identity resolution) but is
  **never** auto-merged into log lines.
- Prefer logging identifiers, counts, durations, and statuses. Use `describe()`
  for anything user-supplied, and `safeMeta()` to filter an untrusted meta bag.

## Config

`LOG_LEVEL` (default `info`) sets the level. `NODE_ENV=production` switches the
console transport from the colorized dev format to one JSON object per line.
