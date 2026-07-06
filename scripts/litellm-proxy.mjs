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

function proxyRequest(targetBaseUrl) {
  const targetBase = new URL(targetBaseUrl);

  return async (req, res) => {
    try {
      const rawBody = await requestBody(req);
      const nextBody = rewriteRequestBody(rawBody);
      const targetPath = req.url?.replace(/^\/v1/, '') || '/';
      const targetUrl = new URL(`${targetBase.pathname.replace(/\/$/, '')}${targetPath}`, targetBase);
      const headers = {
        ...req.headers,
      };
      delete headers.host;
      delete headers.connection;
      delete headers['content-length'];

      const upstreamResponse = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : nextBody,
      });

      res.writeHead(upstreamResponse.status, Object.fromEntries(upstreamResponse.headers.entries()));
      res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
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
