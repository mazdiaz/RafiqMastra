"use client";

import { FormEvent, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ChatResponse = {
  text?: unknown;
  error?: unknown;
};

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(value: unknown) {
  if (value instanceof Error && value.message.trim()) {
    return value.message;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "The agent could not complete that request.";
}

export default function Home() {
  const threadIdRef = useRef(generateId("thread"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const statusText = isSending ? "Sending" : error ? "Needs attention" : "Ready";
  const trimmedInput = input.trim();
  const canSubmit = trimmedInput.length > 0 && !isSending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isSending) {
      return;
    }

    const userMessage: Message = {
      id: generateId("user"),
      role: "user",
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
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

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(data.error));
      }

      if (typeof data.text !== "string") {
        throw new Error("The agent response was missing text.");
      }

      const assistantMessage: Message = {
        id: generateId("assistant"),
        role: "assistant",
        text: data.text,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Agent details">
        <div>
          <p className="eyebrow">Local agent</p>
          <h1>Web Explorer Agent</h1>
          <p className="sidebar-copy">
            Ask the Mastra agent to search, inspect, and summarize web information from the
            local backend.
          </p>
        </div>

        <section className="status-panel" aria-label="Backend status">
          <div className="status-row">
            <span className={`status-dot status-${statusText.toLowerCase().replace(" ", "-")}`} />
            <span>{statusText}</span>
          </div>
          <p>Local Mastra backend</p>
        </section>

        <section className="capabilities" aria-label="Capabilities">
          <span>Web research</span>
          <span>Source review</span>
          <span>Session memory</span>
        </section>
      </aside>

      <section className="chat-panel" aria-label="Chat with Web Explorer Agent">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Conversation</p>
            <h2>Agent workspace</h2>
          </div>
          <span className="message-count">
            {messages.length === 1 ? "1 message" : `${messages.length} messages`}
          </span>
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <div className="message-list" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h3>Start a working session</h3>
              <p>
                Send a question or research task. This browser session keeps one thread id so the
                agent can retain context while you stay on the page.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message message-${message.role}`}>
                <span>{message.role === "user" ? "You" : "Web Explorer Agent"}</span>
                <p>{message.text}</p>
              </article>
            ))
          )}

          {isSending ? (
            <article className="message message-assistant message-pending">
              <span>Web Explorer Agent</span>
              <p>Working on it...</p>
            </article>
          ) : null}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <label htmlFor="chat-input">Message</label>
          <div className="composer-row">
            <textarea
              id="chat-input"
              name="message"
              placeholder="Ask the agent to research a topic..."
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isSending}
            />
            <button type="submit" disabled={!canSubmit}>
              Send
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
