# Microsoft Teams through Connection Hub

Studio exposes `POST /api/connection-hub/teams`. It derives client and project from the validated session, looks up the project's enabled `teams-read` binding, and calls Connection Hub with the existing server-side `CONNECTION_HUB_*` settings. No Microsoft credentials reach the browser.

The binding chooses the encrypted Microsoft connection, approved runtime package and allowed team. Team IDs, connector versions, provider URLs and connection IDs cannot be supplied in browser requests. Reads are restricted to the configured team, its channels and their messages. Lists return one provider page; this POC does not follow `@odata.nextLink`, send messages, read chats or refresh OAuth tokens. No Teams UI page is included.

In connection-hub, set `MS_TEAMS_TENANT_ID` to the Microsoft Entra directory GUID, `MS_TEAMS_TEAM_ID` to the allowed team GUID, and `MS_TEAMS_ACCESS_TOKEN` to a valid Graph OAuth token. Microsoft directory identity is separate from the CustomerSax client/Hub tenant. Build and restart Hub, then run `npm run activate:teams -- b2c-csa`. Restart Studio to load the new route.

For a delegated work/school token, configure `Team.ReadBasic.All`, `Channel.ReadBasic.All` and `ChannelMessage.Read.All` with required tenant consent. See [Microsoft's permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference). Activation validates channel access; message access is checked when used.

Select b2c-csa in Studio and run in the browser console:

```js
await fetch('/api/connection-hub/teams', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ operation: 'channels' })
}).then(response => response.json())
```

Use a returned channel's `id` with `{ operation: 'messages', channelId, limit: 20 }`. Use `{ operation: 'message', channelId, messageId }` to read one message through the upstream Activepieces action. `{ operation: 'team' }` reads the configured team. Successful responses include `data` and execution metadata with connector, binding, connection, version, digest and cache hit. Provider failures and scope mismatches return safe errors.
