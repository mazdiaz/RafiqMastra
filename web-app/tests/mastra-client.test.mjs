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
