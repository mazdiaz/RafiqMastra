# my-mastra-app

Welcome to your new [Mastra](https://mastra.ai/) project! We're excited to see what you'll build.

## Getting Started

Start the development server:

```shell
npm run dev
```

Create a `.env` file first:

```shell
copy .env.example .env
```

Then put your LiteLLM gateway key in `OPENAI_API_KEY`. This project routes Mastra through a local LiteLLM compatibility proxy at `http://localhost:4120/v1`, which normalizes Qwen/vLLM message ordering and forwards to `https://llm.rafiqspace.ai/v1` with `MASTRA_MODEL=qwen3.6-35b-a3b`.

Open [http://localhost:4111](http://localhost:4111) in your browser to access [Mastra Studio](https://mastra.ai/docs/studio/overview). It provides an interactive UI for building and testing your agents, along with a REST API that exposes your Mastra application as a local service. This lets you start building without worrying about integration right away.

You can start editing files inside the `src/mastra` directory. The development server will automatically reload whenever you make changes.

## Learn more

To learn more about Mastra, visit our [documentation](https://mastra.ai/docs/). Your bootstrapped project includes example code for [agents](https://mastra.ai/docs/agents/overview), [tools](https://mastra.ai/docs/agents/using-tools), [workflows](https://mastra.ai/docs/workflows/overview), [scorers](https://mastra.ai/docs/evals/overview), and [observability](https://mastra.ai/docs/observability/overview).

If you're new to AI agents, check out our [course](https://mastra.ai/learn) and [YouTube videos](https://youtube.com/@mastra-ai). You can also join our [Discord](https://discord.gg/BTYqqHKUrf) community to get help and share your projects.

## Deploy to the Mastra platform

The [Mastra platform](https://projects.mastra.ai) provides two products for deploying and managing AI applications built with the Mastra framework:

- **Studio**: A hosted visual environment for testing agents, running workflows, and inspecting traces
- **Server**: A production deployment target that runs your Mastra application as an API server

Learn more in the [Mastra platform documentation](https://mastra.ai/docs/mastra-platform/overview).

## Next.js Chat App

The `web-app/` directory contains a small Next.js chat UI for the local Mastra Web Explorer Agent.

Start the Mastra backend from the repository root:

```shell
npm run dev
```

In another terminal, start the web app from the repository root:

```shell
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

The web UI calls `/api/chat`, which forwards requests to the local Mastra API at `http://localhost:4111/api` using `MASTRA_AGENT_ID=web-explorer-agent`. No LiteLLM gateway key is used in the browser; gateway secrets stay in the root Mastra `.env` file.
