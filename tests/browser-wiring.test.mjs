import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const browserModuleUrl = new URL('../src/mastra/browsers.ts', import.meta.url);
const webExplorerAgentUrl = new URL('../src/mastra/agents/web-explorer-agent.ts', import.meta.url);
const litellmProxyUrl = new URL('../scripts/litellm-proxy.mjs', import.meta.url);
const devWrapperUrl = new URL('../scripts/dev-with-litellm-proxy.mjs', import.meta.url);
const mastraSource = readFileSync(new URL('../src/mastra/index.ts', import.meta.url), 'utf8');
const envExampleSource = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const litellmProxy = await import(litellmProxyUrl);

assert.ok(
  packageJson.dependencies?.['@mastra/agent-browser'],
  'package.json should depend on @mastra/agent-browser',
);

assert.ok(existsSync(browserModuleUrl), 'src/mastra/browsers.ts should define the shared AgentBrowser instance');
assert.ok(existsSync(webExplorerAgentUrl), 'src/mastra/agents/web-explorer-agent.ts should define the Web Explorer Agent');
assert.ok(existsSync(litellmProxyUrl), 'scripts/litellm-proxy.mjs should define the local LiteLLM compatibility proxy');
assert.ok(existsSync(devWrapperUrl), 'scripts/dev-with-litellm-proxy.mjs should start proxy and Mastra together');

const browserSource = readFileSync(browserModuleUrl, 'utf8');
const agentSource = readFileSync(webExplorerAgentUrl, 'utf8');
const devWrapperSource = readFileSync(devWrapperUrl, 'utf8');
assert.match(browserSource, /AgentBrowser/, 'browsers.ts should construct an AgentBrowser');
assert.match(browserSource, /QwenFriendlyAgentBrowser/, 'browsers.ts should wrap AgentBrowser for Qwen-friendly tool schemas');
assert.match(browserSource, /z\.preprocess/, 'browsers.ts should coerce stringified numeric and boolean browser tool args');
assert.match(browserSource, /browser_goto/, 'browsers.ts should keep browser_goto schema compatibility coverage');
assert.match(browserSource, /browser_snapshot/, 'browsers.ts should keep browser_snapshot schema compatibility coverage');
assert.match(agentSource, /id:\s*'web-explorer-agent'/, 'agent id should be web-explorer-agent');
assert.match(agentSource, /name:\s*'Web Explorer Agent'/, 'agent name should be Web Explorer Agent');
assert.match(agentSource, /from '..\/browsers'/, 'web-explorer-agent should import the shared browser');
assert.match(agentSource, /\bbrowser\b,/, 'web-explorer-agent should pass browser to the Agent config');
assert.match(
  agentSource,
  /browser_snapshot/,
  'web-explorer-agent instructions should tell the model to use browser_snapshot before browser actions',
);
assert.match(
  agentSource,
  /numbers and booleans must never be quoted as strings/,
  'web-explorer-agent instructions should prevent Qwen from sending stringified numeric/boolean tool args',
);
assert.doesNotMatch(agentSource, /weatherTool|Weather Agent|weather assistant/, 'web-explorer-agent should not keep weather-specific behavior');
assert.match(agentSource, /new Memory|@mastra\/memory/, 'web-explorer-agent should keep memory so browser context has thread/resource state');
assert.match(agentSource, /providerId:\s*'openai'/, 'web-explorer-agent should use OpenAI-compatible chat routing for the LiteLLM gateway');
assert.match(agentSource, /url:\s*process\.env\.OPENAI_BASE_URL/, 'web-explorer-agent should pass OPENAI_BASE_URL through model config');
assert.match(agentSource, /apiKey:\s*process\.env\.OPENAI_API_KEY/, 'web-explorer-agent should pass OPENAI_API_KEY through model config');
assert.match(agentSource, /replace\(\s*\/\^openai\\\//, 'web-explorer-agent should tolerate old openai/ model prefixes from env files');
assert.match(agentSource, /qwen3\.6-35b-a3b/, 'web-explorer-agent should default to the LiteLLM Qwen model');
assert.doesNotMatch(agentSource, /openrouter\/free/, 'web-explorer-agent should not default to OpenRouter');
assert.match(mastraSource, /webExplorerAgent/, 'Mastra should register the Web Explorer Agent');
assert.doesNotMatch(mastraSource, /weatherAgent/, 'Mastra should not register the old Weather Agent');
assert.match(envExampleSource, /OPENAI_API_KEY=/, '.env.example should document the LiteLLM API key variable');
assert.match(envExampleSource, /OPENAI_BASE_URL=http:\/\/localhost:4120\/v1/, '.env.example should route Mastra through the local LiteLLM proxy');
assert.match(envExampleSource, /LITELLM_TARGET_BASE_URL=https:\/\/llm\.rafiqspace\.ai\/v1/, '.env.example should document the upstream LiteLLM base URL');
assert.match(envExampleSource, /MASTRA_MODEL=qwen3\.6-35b-a3b/, '.env.example should document the Qwen gateway model');
assert.doesNotMatch(envExampleSource, /OPENROUTER_API_KEY|openrouter\/free/, '.env.example should not point new setup at OpenRouter');
assert.match(packageJson.scripts?.dev ?? '', /dev-with-litellm-proxy\.mjs/, 'npm run dev should start the LiteLLM compatibility proxy before Mastra');
assert.match(devWrapperSource, /process\.execPath/, 'dev wrapper should run Mastra through the current Node executable');
assert.match(devWrapperSource, /node_modules\/mastra\/dist\/index\.js/, 'dev wrapper should call Mastra JavaScript entrypoint directly');
assert.doesNotMatch(devWrapperSource, /mastra\.cmd|cmd\.exe|ComSpec/, 'dev wrapper should avoid Windows shell shims that can fail with spawn EINVAL');

const normalizedMessages = litellmProxy.normalizeQwenMessages([
  { role: 'system', content: 'first' },
  { role: 'user', content: 'hello' },
  { role: 'system', content: 'later' },
  { role: 'assistant', content: 'hi' },
]);

assert.deepEqual(
  normalizedMessages.map((message) => message.role),
  ['system', 'user', 'assistant'],
  'LiteLLM proxy should remove later system messages from the middle of the request',
);
assert.equal(
  normalizedMessages[0].content,
  'first\n\nlater',
  'LiteLLM proxy should merge all system content into the first system message',
);

const normalizedMisplacedSystemMessage = litellmProxy.normalizeQwenMessages([
  { role: 'user', content: 'hello' },
  { role: 'system', content: 'late system instructions' },
  { role: 'assistant', content: 'hi' },
]);

assert.deepEqual(
  normalizedMisplacedSystemMessage.map((message) => message.role),
  ['system', 'user', 'assistant'],
  'LiteLLM proxy should move a single misplaced system message to the beginning for Qwen/vLLM',
);
assert.equal(
  normalizedMisplacedSystemMessage[0].content,
  'late system instructions',
  'LiteLLM proxy should preserve the misplaced system message content when moving it',
);

assert.equal(typeof litellmProxy.rewriteRequestBody, 'function', 'LiteLLM proxy should export request body rewriting for regression coverage');

const rewrittenResponsesBody = JSON.parse(litellmProxy.rewriteRequestBody(JSON.stringify({
  model: 'qwen3.6-35b-a3b',
  input: [
    { role: 'system', content: 'agent instructions' },
    { role: 'system', content: 'browser instructions' },
    { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
  ],
})));

assert.deepEqual(
  rewrittenResponsesBody.input.map((message) => message.role),
  ['system', 'user'],
  'LiteLLM proxy should normalize Responses API input arrays before forwarding to Qwen/vLLM',
);
assert.equal(
  rewrittenResponsesBody.input[0].content,
  'agent instructions\n\nbrowser instructions',
  'LiteLLM proxy should merge Responses API system input content',
);
