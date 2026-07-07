import http from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 4120;
const DEFAULT_TARGET_BASE_URL = 'https://llm.rafiqspace.ai/v1';

function contentToText(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return JSON.stringify(part);
      })
      .join('\n');
  }

  if (content == null) {
    return '';
  }

  return String(content);
}

export function normalizeQwenMessages(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  const systemMessages = [];
  const otherMessages = [];

  for (const message of messages) {
    if (message?.role === 'system') {
      systemMessages.push(message);
    } else {
      otherMessages.push(message);
    }
  }

  if (systemMessages.length === 0 || messages[0]?.role === 'system' && systemMessages.length === 1) {
    return messages;
  }

  const mergedSystemContent = systemMessages
    .map((message) => contentToText(message.content).trim())
    .filter(Boolean)
    .join('\n\n');

  return [
    {
      ...systemMessages[0],
      content: mergedSystemContent,
    },
    ...otherMessages,
  ];
}

export function rewriteRequestBody(rawBody) {
  if (!rawBody) {
    return rawBody;
  }

  try {
    const parsedBody = JSON.parse(rawBody);
    let rewritten = false;

    if (Array.isArray(parsedBody.messages)) {
      parsedBody.messages = normalizeQwenMessages(parsedBody.messages);
      rewritten = true;
    }

    if (Array.isArray(parsedBody.input)) {
      parsedBody.input = normalizeQwenMessages(parsedBody.input);
      rewritten = true;
    }

    if (rewritten) {
      return JSON.stringify(parsedBody);
    }
  } catch {
    return rawBody;
  }

  return rawBody;
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function textFromContent(content) {
  if (typeof content === 'string' || content == null) {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(content);
}

function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    return toolCalls;
  }

  return toolCalls.map((toolCall) => {
    if (!toolCall || typeof toolCall !== 'object') {
      return toolCall;
    }

    const nextToolCall = { ...toolCall };
    const fn = nextToolCall.function;

    if (fn && typeof fn === 'object' && typeof fn.arguments !== 'string') {
      nextToolCall.function = {
        ...fn,
        arguments: fn.arguments == null ? '' : JSON.stringify(fn.arguments),
      };
    }

    return nextToolCall;
  });
}

function normalizeChatChoice(choice) {
  if (!choice || typeof choice !== 'object') {
    return choice;
  }

  const nextChoice = { ...choice };

  if (nextChoice.message && typeof nextChoice.message === 'object') {
    nextChoice.message = { ...nextChoice.message };
    nextChoice.message.content = textFromContent(nextChoice.message.content);
    nextChoice.message.reasoning_content = textFromContent(nextChoice.message.reasoning_content);
    nextChoice.message.reasoning = textFromContent(nextChoice.message.reasoning);
    nextChoice.message.tool_calls = normalizeToolCalls(nextChoice.message.tool_calls);
  }

  if (nextChoice.delta && typeof nextChoice.delta === 'object') {
    nextChoice.delta = { ...nextChoice.delta };
    nextChoice.delta.content = textFromContent(nextChoice.delta.content);
    nextChoice.delta.reasoning_content = textFromContent(nextChoice.delta.reasoning_content);
    nextChoice.delta.reasoning = textFromContent(nextChoice.delta.reasoning);
    nextChoice.delta.tool_calls = normalizeToolCalls(nextChoice.delta.tool_calls);
  }

  return nextChoice;
}

export function rewriteResponseBody(rawBody) {
  if (!rawBody) {
    return rawBody;
  }

  try {
    const parsedBody = JSON.parse(rawBody);

    if (!Array.isArray(parsedBody.choices)) {
      return rawBody;
    }

    parsedBody.choices = parsedBody.choices.map(normalizeChatChoice);
    return JSON.stringify(parsedBody);
  } catch {
    return rawBody;
  }
}

function sanitizeRequestHeaders(headers) {
  const nextHeaders = { ...headers };

  for (const header of [
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'accept-encoding',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'upgrade',
  ]) {
    delete nextHeaders[header];
  }

  return nextHeaders;
}

function sanitizeResponseHeaders(headers, body) {
  const nextHeaders = Object.fromEntries(headers.entries());

  for (const header of [
    'content-encoding',
    'content-length',
    'transfer-encoding',
    'connection',
    'keep-alive',
  ]) {
    delete nextHeaders[header];
  }

  nextHeaders['content-length'] = Buffer.byteLength(body).toString();
  return nextHeaders;
}

function proxyRequest(targetBaseUrl) {
  const targetBase = new URL(targetBaseUrl);

  return async (req, res) => {
    try {
      const rawBody = await requestBody(req);
      const nextBody = rewriteRequestBody(rawBody);
      const targetPath = req.url?.replace(/^\/v1/, '') || '/';
      const targetUrl = new URL(`${targetBase.pathname.replace(/\/$/, '')}${targetPath}`, targetBase);
      const headers = sanitizeRequestHeaders(req.headers);

      const upstreamResponse = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : nextBody,
      });

      const rawResponseBody = Buffer.from(await upstreamResponse.arrayBuffer()).toString('utf8');
      const responseBody = rewriteResponseBody(rawResponseBody);

      res.writeHead(upstreamResponse.status, sanitizeResponseHeaders(upstreamResponse.headers, responseBody));
      res.end(responseBody);
    } catch (error) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `LiteLLM proxy upstream error: ${error.message}` }));
    }
  };
}

export function startLiteLLMProxy({
  port = Number(process.env.LITELLM_PROXY_PORT || DEFAULT_PORT),
  targetBaseUrl = process.env.LITELLM_TARGET_BASE_URL || DEFAULT_TARGET_BASE_URL,
} = {}) {
  const server = http.createServer(proxyRequest(targetBaseUrl));

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      console.log(`LiteLLM compatibility proxy listening on http://localhost:${port}/v1`);
      resolve(server);
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await startLiteLLMProxy();
}
