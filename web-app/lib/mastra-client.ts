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
  messages?: unknown;
};

type MastraMessage = {
  role?: unknown;
  content?: unknown;
};

function isMastraGenerateResponse(data: unknown): data is MastraGenerateResponse {
  return data !== null && typeof data === "object";
}

function isMastraMessage(message: unknown): message is MastraMessage {
  return message !== null && typeof message === "object";
}

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

export function normalizeMastraResponse(data: unknown): ChatResponse {
  if (!isMastraGenerateResponse(data)) {
    return {
      text: "The agent responded, but no readable text was returned.",
      runId: undefined,
    };
  }

  const runId = typeof data.runId === "string" ? data.runId : undefined;

  if (typeof data.text === "string" && data.text.trim()) {
    return {
      text: data.text.trim(),
      runId,
    };
  }

  const assistantMessage = Array.isArray(data.messages)
    ? data.messages
        .slice()
        .reverse()
        .find((message): message is MastraMessage => {
          return isMastraMessage(message) && message.role === "assistant";
        })
    : undefined;

  if (assistantMessage) {
    const content = assistantMessage.content;

    if (typeof content === "string" && content.trim()) {
      return {
        text: content.trim(),
        runId,
      };
    }

    if (content && typeof content === "object" && "content" in content) {
      const value = (content as { content?: unknown }).content;

      if (typeof value === "string" && value.trim()) {
        return {
          text: value.trim(),
          runId,
        };
      }
    }
  }

  return {
    text: "The agent responded, but no readable text was returned.",
    runId,
  };
}
