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
  const runId = typeof data.runId === "string" ? data.runId : undefined;

  if (typeof data.text === "string" && data.text.trim()) {
    return {
      text: data.text.trim(),
      runId,
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
