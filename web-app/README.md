# Web Explorer Agent App

Small Next.js chat UI for the local Mastra Web Explorer Agent.

## Run

From the repository root, start the Mastra backend:

```shell
npm run dev
```

In another terminal, start the web app:

```shell
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

The web app uses these local defaults:

```shell
MASTRA_API_URL=http://localhost:4111/api
MASTRA_AGENT_ID=web-explorer-agent
```

The browser does not use a LiteLLM gateway key. Gateway secrets stay in the root Mastra `.env` file.
