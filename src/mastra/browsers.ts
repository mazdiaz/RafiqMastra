import { AgentBrowser, browserSchemas } from '@mastra/agent-browser';
import { z } from 'zod';

const optionalNumber = z.preprocess((value) => {
  if (value === '' || value == null) return undefined;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === '' || value == null) return undefined;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean().optional());

const qwenFriendlyInputSchemas = {
  browser_goto: browserSchemas.goto.safeExtend({
    timeout: optionalNumber,
  }),
  browser_snapshot: browserSchemas.snapshot.safeExtend({
    interactiveOnly: optionalBoolean,
    maxDepth: optionalNumber,
  }),
  browser_click: browserSchemas.click.safeExtend({
    clickCount: optionalNumber,
    timeout: optionalNumber,
  }),
  browser_type: browserSchemas.type.safeExtend({
    clear: optionalBoolean,
    delay: optionalNumber,
  }),
  browser_press: browserSchemas.press.safeExtend({
    timeout: optionalNumber,
  }),
  browser_select: browserSchemas.select.safeExtend({
    index: optionalNumber,
    timeout: optionalNumber,
  }),
  browser_scroll: browserSchemas.scroll.safeExtend({
    amount: optionalNumber,
  }),
  browser_wait: browserSchemas.wait.safeExtend({
    timeout: optionalNumber,
  }),
  browser_tabs: browserSchemas.tabs.safeExtend({
    index: optionalNumber,
  }),
};

class QwenFriendlyAgentBrowser extends AgentBrowser {
  getTools() {
    const tools = super.getTools();

    for (const [toolName, inputSchema] of Object.entries(qwenFriendlyInputSchemas)) {
      if (tools[toolName]) {
        tools[toolName].inputSchema = inputSchema;
      }
    }

    return tools;
  }
}

export const browser = new QwenFriendlyAgentBrowser({
  headless: false,
  excludeTools: ['browser_screenshot'],
});
