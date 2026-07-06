# Next.js Agent Chat Design

## Goal

Build a small Next.js app that lets users chat with the Mastra Web Explorer Agent without opening Mastra Studio.

## Scope

- Add a separate `web-app/` Next.js project inside the existing Mastra repository.
- Keep Mastra as the backend agent server on `http://localhost:4111`.
- Run Next.js separately, normally on `http://localhost:3000`.
- Provide one usable chat page for sending prompts and reading agent responses.
- Do not expose LiteLLM or gateway API keys to the browser.

## Architecture

The repository will contain two runnable apps:

- Mastra backend: existing project root, started with `npm run dev`.
- Next.js frontend: `web-app/`, started with its own `npm run dev`.

The browser calls the Next.js API route, not Mastra directly. The Next.js API route forwards requests to Mastra's local API.

```text
User browser
  -> Next.js page
  -> Next.js /api/chat
  -> Mastra API at http://localhost:4111/api
  -> web-explorer-agent
```

## UI

The first screen is the app itself, not a landing page. It uses a compact work-tool layout:

- Left sidebar: agent name, local backend status, short capability labels.
- Main panel: message history with user and assistant bubbles.
- Bottom composer: multiline input and send button.
- Visible states: idle, sending, error, and empty conversation.

The visual style should be restrained and operational: clear spacing, readable typography, neutral background, and no decorative hero layout.

## API Behavior

The Next.js API route accepts:

```json
{
  "message": "User prompt text"
}
```

It forwards the prompt to the Web Explorer Agent through the Mastra API. It returns:

```json
{
  "text": "Assistant response text"
}
```

If Mastra is not running or returns an error, the route returns a user-readable error message and a non-2xx status.

## Configuration

`web-app/.env.example` will document:

```text
MASTRA_API_URL=http://localhost:4111/api
MASTRA_AGENT_ID=web-explorer-agent
```

No LiteLLM key or OpenAI-compatible key is needed in the frontend app.

## Testing And Verification

- Add a focused local test or script that validates the request payload helper/API route behavior where practical.
- Run `npm test` in the Mastra root to ensure existing agent wiring still passes.
- Run the Next.js build or lint command available in `web-app`.
- Manually verify the app can send a message to the running Web Explorer Agent and render the response.

## Out Of Scope

- Authentication.
- Persistent multi-user chat history.
- Deployment setup.
- File uploads.
- Replacing Mastra Studio entirely.
