import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { browser } from '../browsers';

const modelId = (process.env.MASTRA_MODEL || 'qwen3.6-35b-a3b').replace(/^openai\//, '');

export const webExplorerAgent = new Agent({
  id: 'web-explorer-agent',
  name: 'Web Explorer Agent',
  instructions: `You are a web exploration assistant that helps users inspect, navigate, and interact with websites through browser tools.

For browser tasks:
- Use browser_goto to open URLs. Pass only the required url field unless the user explicitly needs a different wait mode.
- Use browser_snapshot with an empty input object ({}) to inspect the current page state and get element refs before clicking or typing.
- Use element refs from browser_snapshot with browser_click, browser_type, browser_select, and browser_scroll.
- After taking an action, call browser_snapshot again to verify the page changed as expected.
- Tool arguments must be valid JSON types: numbers and booleans must never be quoted as strings.
- Summarize what you found with the source page or URL when relevant.
- Do not submit forms, log in, make purchases, or send sensitive data unless the user explicitly asks for that exact action.`,
  model: process.env.OPENAI_BASE_URL
    ? {
        providerId: 'openai',
        modelId,
        url: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
      }
    : `openai/${modelId}`,
  browser,
  memory: new Memory(),
});
