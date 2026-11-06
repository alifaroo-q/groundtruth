import { runAgent } from "@/lib/agent";
import type { AgentEvent, Scenario } from "@/lib/domain";
import { createPort } from "@/lib/model";

// No `runtime`/`dynamic` exports: cacheComponents rejects them, and POST handlers are never cached.

const MAX_MARKDOWN = 60_000;
const MAX_FIELD = 2_000;
const MAX_RULES = 30;

function parseScenario(body: unknown): Scenario | string {
  const s = (body as { scenario?: Record<string, unknown> } | null)?.scenario;
  if (!s || typeof s !== "object") return "Body must be { scenario: Scenario }";
  for (const key of ["id", "name", "company", "docPath", "buyerQuestion"] as const) {
    const v = s[key];
    if (typeof v !== "string" || !v.trim() || v.length > MAX_FIELD) return `scenario.${key} must be a non-empty string under ${MAX_FIELD} chars`;
  }
  if (typeof s.publicMarkdown !== "string" || !s.publicMarkdown.trim() || s.publicMarkdown.length > MAX_MARKDOWN) {
    return `scenario.publicMarkdown must be a non-empty string under ${MAX_MARKDOWN} chars`;
  }
  const rules = s.groundTruthRules;
  if (
    !Array.isArray(rules) ||
    rules.length === 0 ||
    rules.length > MAX_RULES ||
    !rules.every((r) => typeof r === "string" && r.trim() && r.length <= MAX_FIELD)
  ) {
    return `scenario.groundTruthRules must be 1 to ${MAX_RULES} non-empty strings`;
  }
  return s as Scenario;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const scenario = parseScenario(body);
  if (typeof scenario === "string") return Response.json({ error: scenario }, { status: 400 });

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runAgent(scenario, createPort(scenario), emit);
      } catch (e) {
        emit({ type: "run_error", message: e instanceof Error ? e.message : String(e) });
      }
      if (open) controller.close();
    },
    cancel() {
      open = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
