# CSA Ticketing Service

Standalone Apollo subgraph for ticket operations.

## Local Env

Copy `.env.example` to `.env` and set:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_TICKETS_COLLECTION`
- `TICKETING_PROJECT_KEY`

Every ticket query/write is scoped by `projectKey`.
