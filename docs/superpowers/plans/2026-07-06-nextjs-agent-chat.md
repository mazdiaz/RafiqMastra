# Next.js Agent Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small Next.js app in `web-app/` that lets users chat with the local Mastra `web-explorer-agent` without opening Mastra Studio.

**Architecture:** The root Mastra app remains the backend on `http://localhost:4111`, including the local LiteLLM compatibility proxy on `http://localhost:4120/v1`. The new Next.js app runs separately on `http://localhost:3000`; the browser posts to `web-app/app/api/chat/route.ts`, which forwards to `POST ${MASTRA_API_URL}/agents/${MASTRA_AGENT_ID}/generate` with `memory.resource` and `memory.thread`, then returns normalized `{ text, runId }` JSON to the page.

**Tech Stack:** Next.js App Router, React, TypeScript, plain CSS, Node fetch, existing Mastra API.

---

## Endpoint Contract Verified

Mastra is reachable at `http://localhost:4111/api`.

Verified agent list:

```powershell
Invoke-WebRequest -Uri http://localhost:4111/api/agents -UseBasicParsing
```

Verified generate call:

```powershell
Invoke-RestMethod -Uri http://localhost:4111/api/agents/web-explorer-agent/generate -Method Post -ContentType "application/json" -Body '{"messages":"Reply with exactly: ok","memory":{"resource":"web-app","thread":"codex-endpoint-check"}}'
```

Important behavior:

- Calling `generate` without memory fails with `computeStateSignal requires Mastra memory with an active resourceId and threadId`.
- The Next.js route must send `memory: { resource: "web-app", thread: <client thread id> }`.
- A successful response includes `text`, `runId`, `usage`, `messages`, and other metadata.

## File Structure

- Create: `web-app/package.json` - Next.js project scripts and dependencies.
- Create: `web-app/next.config.ts` - minimal Next.js config.
- Create: `web-app/tsconfig.json` - TypeScript config for App Router.
- Create: `web-app/.env.example` - local Mastra API URL and agent id.
- Create: `web-app/app/layout.tsx` - document shell and metadata.
- Create: `web-app/app/page.tsx` - client chat UI and interaction state.
- Create: `web-app/app/globals.css` - compact operational UI styling.
- Create: `web-app/app/api/chat/route.ts` - server-side proxy route to Mastra.
- Create: `web-app/lib/mastra-client.ts` - request validation, endpoint building, response normalization.
- Create: `web-app/tests/mastra-client.test.mjs` - focused Node test for helper behavior.
- Create: `web-app/test/mastra-client-fixture.mjs` - testable mirror of helper logic for Node without a TS test runner.
- Create: `web-app/README.md` - run instructions for Mastra and Next.js together.
- Modify: `package.json` - add root convenience scripts for `dev:web`, `build:web`, and `test:web`.
- Modify: `README.md` if it exists - add short frontend usage section; create it if missing.

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `web-app/package.json`
- Create: `web-app/next.config.ts`
- Create: `web-app/tsconfig.json`
- Create: `web-app/.env.example`
- Modify: `package.json`

- [ ] **Step 1: Create `web-app/package.json`**

```json
{
  "name": "rafiq-mastra-web-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test tests/*.test.mjs"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create `web-app/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Create `web-app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `web-app/.env.example`**

```text
MASTRA_API_URL=http://localhost:4111/api
MASTRA_AGENT_ID=web-explorer-agent
```

- [ ] **Step 5: Modify root `package.json` scripts**

Keep existing scripts and add these entries inside `scripts`:

```json
{
  "dev:web": "npm --prefix web-app run dev",
  "build:web": "npm --prefix web-app run build",
  "test:web": "npm --prefix web-app test"
}
```

- [ ] **Step 6: Install Next.js dependencies**

Run:

```powershell
npm install --prefix web-app
```

Expected: `web-app/package-lock.json` is created and dependencies install without errors.

- [ ] **Step 7: Commit scaffold**

Run:

```powershell
git add package.json web-app/package.json web-app/package-lock.json web-app/next.config.ts web-app/tsconfig.json web-app/.env.example
git commit -m "feat: scaffold Next.js agent app"
```

Expected: commit succeeds.

## Task 2: Add Mastra Client Helper And Tests

**Files:**
- Create: `web-app/lib/mastra-client.ts`
- Create: `web-app/test/mastra-client-fixture.mjs`
- Create: `web-app/tests/mastra-client.test.mjs`

- [ ] **Step 1: Create `web-app/lib/mastra-client.ts`**

```ts
export type ChatRequest = {
  message: string;
  threadId: string;
};

export type ChatResponse = {
  text: string;
  runId?: string;
};

type MastraGenerateResponse = {
  text?: unknown;
  runId?: unknown;
  messages?: Array<{
    role?: unknown;
    content?: unknown;
  }>;
};

export function normalizeBaseUrl(value: string | undefined): string {
  const baseUrl = value?.trim() || "http://localhost:4111/api";
  return baseUrl.replace(/\/+$/, "");
}

export function resolveAgentId(value: string | undefined): string {
  return value?.trim() || "web-explorer-agent";
}

export function buildGenerateUrl(baseUrl: string, agentId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/agents/${encodeURIComponent(agentId)}/generate`;
}

export function buildMastraGenerateBody(request: ChatRequest) {
  const message = request.message.trim();
  const threadId = request.threadId.trim();

  if (!message) {
    throw new Error("Message is required.");
  }

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  return {
    messages: message,
    memory: {
      resource: "web-app",
      thread: threadId,
    },
  };
}

export function normalizeMastraResponse(data: MastraGenerateResponse): ChatResponse {
  if (typeof data.text === "string" && data.text.trim()) {
    return {
      text: data.text.trim(),
      runId: typeof data.runId === "string" ? data.runId : undefined,
    };
  }

  const assistantMessage = data.messages
    ?.slice()
    .reverse()
    .find((message) => message.role === "assistant");

  if (assistantMessage) {
    const content = assistantMessage.content;

    if (typeof content === "string" && content.trim()) {
      return {
        text: content.trim(),
        runId: typeof data.runId === "string" ? data.runId : undefined,
      };
    }

    if (content && typeof content === "object" && "content" in content) {
      const value = (content as { content?: unknown }).content;
      if (typeof value === "string" && value.trim()) {
        return {
          text: value.trim(),
          runId: typeof data.runId === "string" ? data.runId : undefined,
        };
      }
    }
  }

  return {
    text: "The agent responded, but no readable text was returned.",
    runId: typeof data.runId === "string" ? data.runId : undefined,
  };
}
```

- [ ] **Step 2: Create `web-app/test/mastra-client-fixture.mjs`**

This mirrors the pure helper functions so `node --test` can validate behavior before wiring Next.js transpilation.

```js
export function normalizeBaseUrl(value) {
  const baseUrl = value?.trim() || "http://localhost:4111/api";
  return baseUrl.replace(/\/+$/, "");
}

export function resolveAgentId(value) {
  return value?.trim() || "web-explorer-agent";
}

export function buildGenerateUrl(baseUrl, agentId) {
  return `${normalizeBaseUrl(baseUrl)}/agents/${encodeURIComponent(agentId)}/generate`;
}

export function buildMastraGenerateBody(request) {
  const message = request.message.trim();
  const threadId = request.threadId.trim();

  if (!message) {
    throw new Error("Message is required.");
  }

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  return {
    messages: message,
    memory: {
      resource: "web-app",
      thread: threadId,
    },
  };
}

export function normalizeMastraResponse(data) {
  if (typeof data.text === "string" && data.text.trim()) {
    return {
      text: data.text.trim(),
      runId: typeof data.runId === "string" ? data.runId : undefined,
    };
  }

  const assistantMessage = data.messages
    ?.slice()
    .reverse()
    .find((message) => message.role === "assistant");

  if (assistantMessage) {
    const content = assistantMessage.content;

    if (typeof content === "string" && content.trim()) {
      return {
        text: content.trim(),
        runId: typeof data.runId === "string" ? data.runId : undefined,
      };
    }

    if (content && typeof content === "object" && "content" in content) {
      const value = content.content;
      if (typeof value === "string" && value.trim()) {
        return {
          text: value.trim(),
          runId: typeof data.runId === "string" ? data.runId : undefined,
        };
      }
    }
  }

  return {
    text: "The agent responded, but no readable text was returned.",
    runId: typeof data.runId === "string" ? data.runId : undefined,
  };
}
```

- [ ] **Step 3: Create `web-app/tests/mastra-client.test.mjs`**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenerateUrl,
  buildMastraGenerateBody,
  normalizeMastraResponse,
} from "../test/mastra-client-fixture.mjs";

test("buildGenerateUrl points at the Mastra generate endpoint", () => {
  assert.equal(
    buildGenerateUrl("http://localhost:4111/api/", "web-explorer-agent"),
    "http://localhost:4111/api/agents/web-explorer-agent/generate",
  );
});

test("buildMastraGenerateBody includes required browser memory", () => {
  assert.deepEqual(buildMastraGenerateBody({ message: " hello ", threadId: " thread-1 " }), {
    messages: "hello",
    memory: {
      resource: "web-app",
      thread: "thread-1",
    },
  });
});

test("buildMastraGenerateBody rejects blank messages", () => {
  assert.throws(
    () => buildMastraGenerateBody({ message: "   ", threadId: "thread-1" }),
    /Message is required/,
  );
});

test("normalizeMastraResponse prefers top-level text", () => {
  assert.deepEqual(normalizeMastraResponse({ text: " ok ", runId: "run-1" }), {
    text: "ok",
    runId: "run-1",
  });
});

test("normalizeMastraResponse falls back to assistant message content", () => {
  assert.deepEqual(
    normalizeMastraResponse({
      messages: [
        { role: "user", content: "question" },
        { role: "assistant", content: { content: "answer" } },
      ],
    }),
    { text: "answer", runId: undefined },
  );
});
```

- [ ] **Step 4: Run web helper tests**

Run:

```powershell
npm --prefix web-app test
```

Expected: all five tests pass.

- [ ] **Step 5: Commit helper and tests**

Run:

```powershell
git add web-app/lib/mastra-client.ts web-app/test/mastra-client-fixture.mjs web-app/tests/mastra-client.test.mjs
git commit -m "feat: add Mastra chat client helper"
```

Expected: commit succeeds.

## Task 3: Add Next.js API Route

**Files:**
- Create: `web-app/app/api/chat/route.ts`

- [ ] **Step 1: Create `web-app/app/api/chat/route.ts`**

```ts
import { NextResponse } from "next/server";
import {
  buildGenerateUrl,
  buildMastraGenerateBody,
  normalizeMastraResponse,
  normalizeBaseUrl,
  resolveAgentId,
} from "../../../lib/mastra-client";

export const runtime = "nodejs";

type IncomingBody = {
  message?: unknown;
  threadId?: unknown;
};

export async function POST(request: Request) {
  let body: IncomingBody;

  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.message !== "string") {
    return NextResponse.json({ error: "Message must be a string." }, { status: 400 });
  }

  if (typeof body.threadId !== "string") {
    return NextResponse.json({ error: "Thread id must be a string." }, { status: 400 });
  }

  let payload: ReturnType<typeof buildMastraGenerateBody>;

  try {
    payload = buildMastraGenerateBody({
      message: body.message,
      threadId: body.threadId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid chat request." },
      { status: 400 },
    );
  }

  const url = buildGenerateUrl(
    normalizeBaseUrl(process.env.MASTRA_API_URL),
    resolveAgentId(process.env.MASTRA_AGENT_ID),
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const upstreamError =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Mastra returned HTTP ${response.status}.`;

      return NextResponse.json({ error: upstreamError }, { status: 502 });
    }

    return NextResponse.json(normalizeMastraResponse(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Mastra.";
    return NextResponse.json(
      { error: `Unable to reach the local Mastra agent server. ${message}` },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Run build to catch route import/type errors**

Run:

```powershell
npm --prefix web-app run build
```

Expected: build succeeds. If dependencies are not installed yet, run `npm install --prefix web-app` first.

- [ ] **Step 3: Commit API route**

Run:

```powershell
git add web-app/app/api/chat/route.ts
git commit -m "feat: proxy chat requests to Mastra"
```

Expected: commit succeeds.

## Task 4: Build Chat UI

**Files:**
- Create: `web-app/app/layout.tsx`
- Create: `web-app/app/page.tsx`
- Create: `web-app/app/globals.css`

- [ ] **Step 1: Create `web-app/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Explorer Agent",
  description: "Chat with the local Mastra Web Explorer Agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create `web-app/app/page.tsx`**

```tsx
"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const threadIdRef = useRef(createId("web-app-thread"));

  const statusText = useMemo(() => {
    if (isSending) {
      return "Sending";
    }

    if (error) {
      return "Needs attention";
    }

    return "Ready";
  }, [error, isSending]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isSending) {
      return;
    }

    const userMessage: Message = {
      id: createId("user"),
      role: "user",
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          threadId: threadIdRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Agent request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          text: typeof data.text === "string" ? data.text : "No response text returned.",
        },
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to send message.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Agent status">
        <div>
          <p className="eyebrow">Local Mastra Agent</p>
          <h1>Web Explorer Agent</h1>
          <p className="sidebar-copy">
            Chat interface for the browser-capable Mastra agent running on your machine.
          </p>
        </div>

        <div className="status-panel">
          <span className={`status-dot ${error ? "status-dot-error" : ""}`} aria-hidden="true" />
          <div>
            <p className="status-label">Backend</p>
            <p className="status-value">{statusText}</p>
          </div>
        </div>

        <div className="capabilities" aria-label="Agent capabilities">
          <span>Browse</span>
          <span>Inspect</span>
          <span>Summarize</span>
        </div>
      </aside>

      <section className="chat-panel" aria-label="Chat">
        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p className="eyebrow">New chat</p>
              <h2>Ask the agent to inspect a web page.</h2>
              <p>
                Try: open example.com and tell me the page title. Keep Mastra running in the
                background before sending.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article className={`message message-${message.role}`} key={message.id}>
                <p className="message-role">{message.role === "user" ? "You" : "Agent"}</p>
                <p>{message.text}</p>
              </article>
            ))
          )}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            aria-label="Message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask the agent to browse, inspect, or summarize..."
            rows={3}
          />
          <button type="submit" disabled={!input.trim() || isSending}>
            {isSending ? "Sending" : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create `web-app/app/globals.css`**

```css
:root {
  color-scheme: dark;
  --bg: #101214;
  --surface: #171a1f;
  --surface-2: #20252b;
  --border: #303741;
  --text: #f2f5f7;
  --muted: #a8b2bd;
  --accent: #47c7a5;
  --accent-strong: #71d9bd;
  --error: #ff7a7a;
  --shadow: rgba(0, 0, 0, 0.28);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
textarea {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 28px;
}

.eyebrow,
.status-label,
.message-role {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
p {
  overflow-wrap: anywhere;
}

h1 {
  margin: 8px 0 12px;
  font-size: 1.65rem;
}

h2 {
  margin: 8px 0 10px;
  font-size: 1.45rem;
}

.sidebar-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.status-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  padding: 14px;
}

.status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px rgba(71, 199, 165, 0.16);
}

.status-dot-error {
  background: var(--error);
  box-shadow: 0 0 0 4px rgba(255, 122, 122, 0.16);
}

.status-value {
  margin: 2px 0 0;
  font-weight: 700;
}

.capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.capabilities span {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 10px;
  color: var(--muted);
  font-size: 0.86rem;
}

.chat-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  min-width: 0;
  background: #0f1113;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 32px;
}

.empty-state {
  max-width: 620px;
  align-self: center;
  margin: auto;
  color: var(--muted);
  text-align: center;
}

.empty-state h2 {
  color: var(--text);
}

.message {
  width: min(760px, 92%);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  line-height: 1.58;
  box-shadow: 0 12px 30px var(--shadow);
}

.message p:last-child {
  margin-bottom: 0;
}

.message-user {
  align-self: flex-end;
  background: #183a35;
}

.message-assistant {
  align-self: flex-start;
  background: var(--surface);
}

.message-role {
  margin-bottom: 8px;
}

.error-banner {
  margin: 0 32px 16px;
  border: 1px solid rgba(255, 122, 122, 0.5);
  border-radius: 8px;
  background: rgba(255, 122, 122, 0.12);
  color: #ffd3d3;
  padding: 12px 14px;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 12px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 18px 24px;
}

.composer textarea {
  width: 100%;
  min-height: 72px;
  max-height: 180px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #0f1113;
  color: var(--text);
  padding: 12px;
  outline: none;
}

.composer textarea:focus {
  border-color: var(--accent);
}

.composer button {
  align-self: stretch;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #06110e;
  cursor: pointer;
  font-weight: 800;
}

.composer button:hover:not(:disabled) {
  background: var(--accent-strong);
}

.composer button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 820px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 20px;
  }

  .messages {
    padding: 20px;
  }

  .composer {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .composer button {
    min-height: 46px;
  }
}
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm --prefix web-app run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit UI**

Run:

```powershell
git add web-app/app/layout.tsx web-app/app/page.tsx web-app/app/globals.css
git commit -m "feat: add web explorer chat UI"
```

Expected: commit succeeds.

## Task 5: Add Documentation

**Files:**
- Create: `web-app/README.md`
- Modify or create: `README.md`

- [ ] **Step 1: Create `web-app/README.md`**

```md
# Web Explorer Agent App

Small Next.js chat UI for the local Mastra Web Explorer Agent.

## Run

Start Mastra from the repository root:

```powershell
npm run dev
```

Start the web app from the repository root in another terminal:

```powershell
npm run dev:web
```

Open:

```text
http://localhost:3000
```

## Configuration

The app reads:

```text
MASTRA_API_URL=http://localhost:4111/api
MASTRA_AGENT_ID=web-explorer-agent
```

No LiteLLM gateway key is used in the browser. Gateway secrets stay in the root Mastra `.env`.
```

- [ ] **Step 2: Add root README section**

If `README.md` exists, append this section. If it does not exist, create the file with this section:

```md
## Next.js Chat App

This repository includes a small Next.js UI in `web-app/` for chatting with the local Mastra `web-explorer-agent`.

Run Mastra:

```powershell
npm run dev
```

Run the web UI in another terminal:

```powershell
npm run dev:web
```

Then open `http://localhost:3000`.

The web UI calls its own `/api/chat` route. That route forwards to the local Mastra API at `http://localhost:4111/api`, so LiteLLM and gateway secrets remain server-side.
```

- [ ] **Step 3: Commit docs**

Run:

```powershell
git add README.md web-app/README.md
git commit -m "docs: explain Next.js chat app"
```

Expected: commit succeeds.

## Task 6: Verify End To End

**Files:**
- No source file changes unless verification exposes a defect.

- [ ] **Step 1: Run root Mastra tests**

Run:

```powershell
npm test
```

Expected: existing browser wiring tests pass.

- [ ] **Step 2: Run web tests**

Run:

```powershell
npm --prefix web-app test
```

Expected: all helper tests pass.

- [ ] **Step 3: Run Next.js production build**

Run:

```powershell
npm --prefix web-app run build
```

Expected: build succeeds.

- [ ] **Step 4: Ensure Mastra is running**

Run:

```powershell
netstat -ano | findstr ":4111 :4120"
```

Expected: ports `4111` and `4120` show `LISTENING`.

- [ ] **Step 5: Start the web app**

Run:

```powershell
npm run dev:web
```

Expected: Next.js prints a local URL, normally `http://localhost:3000`.

- [ ] **Step 6: Browser-test the app**

Use the in-app browser at `http://localhost:3000`.

Prompt:

```text
Reply with exactly: ok
```

Expected UI result: assistant message renders `ok`.

Prompt:

```text
Open https://example.com, inspect the page, and tell me the H1 text.
```

Expected UI result: assistant message mentions `Example Domain`.

- [ ] **Step 7: Commit verification fixes if needed**

If any verification defect required code changes, commit them:

```powershell
git add web-app README.md package.json
git commit -m "fix: stabilize Next.js agent chat"
```

Expected: commit succeeds only if there were changes.

## Task 7: Push To GitHub

**Files:**
- No source file changes.

- [ ] **Step 1: Review final git status**

Run:

```powershell
git status --short
```

Expected: clean or only intentional uncommitted files.

- [ ] **Step 2: Push commits**

Run:

```powershell
git push origin main
```

Expected: push succeeds to `https://github.com/mazdiaz/RafiqMastra.git`.

## Self-Review

- Spec coverage: The plan creates `web-app/`, keeps Mastra on `4111`, uses a Next.js API route instead of browser-to-Mastra direct calls, avoids exposing gateway keys, implements idle/sending/error/empty UI states, documents env vars, verifies helper tests, root tests, build, and manual browser behavior.
- Placeholder scan: No deferred work markers or undefined task references remain.
- Type consistency: `ChatRequest`, `ChatResponse`, `buildMastraGenerateBody`, and `normalizeMastraResponse` are defined before use. `route.ts` imports match `web-app/lib/mastra-client.ts`. UI posts `{ message, threadId }`, and the route expects those exact names.
