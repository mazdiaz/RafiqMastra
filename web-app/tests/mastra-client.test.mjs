import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import ts from "typescript";

const tempDir = mkdtempSync(join(tmpdir(), "mastra-client-test-"));
const sourcePath = new URL("../lib/mastra-client.ts", import.meta.url);
const compiledPath = join(tempDir, "mastra-client.mjs");
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

writeFileSync(compiledPath, compiled.outputText);

after(() => {
  rmSync(tempDir, { force: true, recursive: true });
});

const { buildGenerateUrl, buildMastraGenerateBody, normalizeMastraResponse } = await import(
  pathToFileURL(compiledPath)
);

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

test("normalizeMastraResponse returns fallback for non-object responses", () => {
  assert.deepEqual(normalizeMastraResponse(null), {
    text: "The agent responded, but no readable text was returned.",
    runId: undefined,
  });
});

test("normalizeMastraResponse ignores non-array messages", () => {
  assert.deepEqual(normalizeMastraResponse({ messages: {} }), {
    text: "The agent responded, but no readable text was returned.",
    runId: undefined,
  });
});
