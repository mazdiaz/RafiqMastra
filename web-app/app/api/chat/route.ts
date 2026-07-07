import { NextResponse } from "next/server";
import {
  buildGenerateUrl,
  buildMastraGenerateBody,
  normalizeBaseUrl,
  normalizeMastraResponse,
  resolveAgentId,
} from "../../../lib/mastra-client";

export const runtime = "nodejs";

type IncomingBody = {
  message?: unknown;
  threadId?: unknown;
};

function isIncomingBody(value: unknown): value is IncomingBody {
  return value !== null && typeof value === "object";
}

function getUpstreamError(data: unknown, status: number): string {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data !== null && typeof data === "object") {
    if ("error" in data && typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }

    if ("message" in data && typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
  }

  return `Mastra returned HTTP ${status}.`;
}

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const body = isIncomingBody(parsedBody) ? parsedBody : {};

  if (typeof body.message !== "string") {
    return NextResponse.json({ error: "Message must be a string." }, { status: 400 });
  }

  if (typeof body.threadId !== "string") {
    return NextResponse.json({ error: "Thread id must be a string." }, { status: 400 });
  }

  let payload: ReturnType<typeof buildMastraGenerateBody>;

  try {
    payload = buildMastraGenerateBody({
      message: body.message,
      threadId: body.threadId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid chat request." },
      { status: 400 },
    );
  }

  const url = buildGenerateUrl(
    normalizeBaseUrl(process.env.MASTRA_API_URL),
    resolveAgentId(process.env.MASTRA_AGENT_ID),
  );

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Mastra.";
    return NextResponse.json(
      { error: `Unable to reach the local Mastra agent server. ${message}` },
      { status: 502 },
    );
  }

  let text: string;

  try {
    text = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Mastra.";
    return NextResponse.json(
      { error: `Unable to reach the local Mastra agent server. ${message}` },
      { status: 502 },
    );
  }

  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Mastra returned a response that was not valid JSON." },
        { status: 502 },
      );
    }
  }

  if (!response.ok) {
    return NextResponse.json({ error: getUpstreamError(data, response.status) }, { status: 502 });
  }

  return NextResponse.json(normalizeMastraResponse(data));
}
