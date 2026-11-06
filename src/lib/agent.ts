import type { Content } from "@google/genai";
import { createTwoFilesPatch, FILE_HEADERS_ONLY } from "diff";
import {
  DEFECT_TYPES,
  HARM_LEVELS,
  type AgentEvent,
  type DefectRecord,
  type PrArtifact,
  type RewriteDraft,
  type Scenario,
  type StepId,
  type StepOutput,
} from "./domain";
import type { ModelPort } from "./model";
import { STEPS } from "./steps";

type RunContext = { scenario: Scenario; port: ModelPort; outputs: Partial<StepOutput> };

type Executor<S extends StepId> = {
  run(ctx: RunContext): Promise<StepOutput[S]>;
  toFunctionResponse(output: StepOutput[S]): Record<string, unknown>;
};

const rulesBlock = (rules: string[]) => rules.map((r) => `- ${r}`).join("\n");

function prior<S extends StepId>(ctx: RunContext, step: S): StepOutput[S] {
  const output = ctx.outputs[step];
  if (!output) throw new Error(`${step} output missing from run context`);
  return output as StepOutput[S];
}

function unguidedAnswerPrompt({ publicMarkdown, buyerQuestion }: Pick<Scenario, "publicMarkdown" | "buyerQuestion">) {
  return `You are an AI answer engine. A buyer asked the question below. Answer the buyer directly and confidently from this page in 2 to 4 sentences.
In citedPassages, copy verbatim the passages from the page you relied on.

PAGE:
${publicMarkdown}

QUESTION: ${buyerQuestion}`;
}

export const EXECUTORS: { [S in StepId]: Executor<S> } = {
  parse_doc_claims: {
    async run({ scenario, port }) {
      const report = await port.generate(
        "parse_doc_claims",
        `You audit a public B2B SaaS docs page against internal ground truth.
List every claim on the page that bears on a ground-truth rule. For each, give the claim text, its section, and a status:
- explicit: the page states the rule's condition clearly next to the claim
- buried: the condition is on the page but only far from the claim (footnote, distant FAQ, changelog)
- contradicted: the page asserts or implies the opposite of the rule
- missing: the rule's condition does not appear on the page
relatedRule is the exact text of the rule the claim bears on, or an empty string.
Then list buriedOrMissingConditions: one sentence per condition a buyer would likely miss.

PAGE (${scenario.docPath}):
${scenario.publicMarkdown}

GROUND-TRUTH RULES:
${rulesBlock(scenario.groundTruthRules)}`,
      );
      return {
        ...report,
        claims: report.claims.map((c) => ({ ...c, relatedRule: c.relatedRule || null })),
      };
    },
    toFunctionResponse: (r) => ({
      claims: r.claims.length,
      atRisk: r.claims.filter((c) => c.status !== "explicit").length,
      buriedOrMissingConditions: r.buriedOrMissingConditions,
    }),
  },

  test_buyer_prompt: {
    run: ({ scenario, port }) => port.generate("test_buyer_prompt", unguidedAnswerPrompt(scenario)),
    toFunctionResponse: (s) => ({ answer: s.answer }),
  },

  verify_causal_harm: {
    async run(ctx) {
      const { scenario, port } = ctx;
      const synthesis = prior(ctx, "test_buyer_prompt");
      const prompt = `You verify an AI answer engine's response to a buyer against a company's ground truth.
If the answer contradicts a rule or drops a condition a rule requires, return verdict "defect" with:
- defectType: "False Claim" (asserts something false), "Omitted Condition" (drops a tier, limit, or price condition), or "Broken Route" (sends the buyer to a wrong, renamed, or removed page, URL, or plan)
- harm: "Critical" (compliance, legal, or security exposure), "High" (buyer buys or builds on the wrong plan), "Medium" (wasted setup time or a support ticket), "Low" (cosmetic)
- hallucinatedStatement: the false sentence from the answer
- violatedRule: the exact text of the violated rule
- rootCauseExcerpt: the page passage that caused the error, copied character for character from the page
- rootCauseExplanation: why the page led the answer engine there, and the buyer impact
- acceptanceTest: the observable answer a fixed page must produce for the same question
Otherwise return verdict "no_defect" with a one-sentence rationale.

PAGE (${scenario.docPath}):
${scenario.publicMarkdown}

GROUND-TRUTH RULES:
${rulesBlock(scenario.groundTruthRules)}

BUYER QUESTION: ${scenario.buyerQuestion}

ANSWER ENGINE RESPONSE:
${synthesis.answer}`;

      let record = toDefectRecord(await port.generate("verify_causal_harm", prompt));
      if (record.verdict === "defect" && !scenario.publicMarkdown.includes(record.rootCauseExcerpt)) {
        const retry = `${prompt}\n\nYour previous rootCauseExcerpt was not found verbatim in the page:\n${record.rootCauseExcerpt}\nCopy the excerpt exactly from the page.`;
        record = toDefectRecord(await port.generate("verify_causal_harm", retry));
        if (record.verdict === "defect" && !scenario.publicMarkdown.includes(record.rootCauseExcerpt)) {
          throw new Error(`rootCauseExcerpt is not a verbatim substring of ${scenario.docPath}: "${record.rootCauseExcerpt}"`);
        }
      }
      return record;
    },
    toFunctionResponse: (d) =>
      d.verdict === "defect"
        ? { verdict: d.verdict, defectType: d.defectType, harm: d.harm, rootCauseExcerpt: d.rootCauseExcerpt }
        : { verdict: d.verdict, rationale: d.rationale },
  },

  generate_pr_artifact: {
    async run(ctx) {
      const { scenario, port } = ctx;
      const defect = prior(ctx, "verify_causal_harm");
      if (defect.verdict !== "defect") throw new Error("No defect to remediate");
      const draft = await port.generate(
        "generate_pr_artifact",
        `Rewrite this docs page so an answer engine gives the buyer the correct answer.
Rules:
- Answer first. Add an explicit H2 or H3 heading phrased as the buyer's question.
- The first sentence under that heading states the fact and its tier or price condition.
- Remove or qualify the passage that caused the defect (the root-cause excerpt) and any line that repeats it.
- Leave every other line byte-for-byte unchanged so the diff stays focused.
Return rewrittenMarkdown (the full page), 2 or 3 FAQ entries for FAQPage structured data, productName, prTitle (conventional commit style, e.g. "docs(pricing): ..."), and verificationCheck (how to confirm the fix with the same buyer question).

DEFECT:
${JSON.stringify(defect, null, 2)}

GROUND-TRUTH RULES:
${rulesBlock(scenario.groundTruthRules)}

ORIGINAL PAGE (${scenario.docPath}):
${scenario.publicMarkdown}`,
      );
      return compilePrArtifact(scenario, defect, draft);
    },
    toFunctionResponse: (p) => ({ branchName: p.branchName, prTitle: p.prTitle, diffLines: p.unifiedDiff.split("\n").length }),
  },
};

function toDefectRecord(raw: Record<string, unknown>): DefectRecord {
  if (raw.verdict === "no_defect") return { verdict: "no_defect", rationale: String(raw.rationale ?? "") };
  const fields = ["hallucinatedStatement", "violatedRule", "rootCauseExcerpt", "rootCauseExplanation", "acceptanceTest"] as const;
  const missing = fields.filter((f) => typeof raw[f] !== "string" || !raw[f]);
  const defectType = DEFECT_TYPES.find((t) => t === raw.defectType);
  const harm = HARM_LEVELS.find((h) => h === raw.harm);
  if (raw.verdict !== "defect" || !defectType || !harm || missing.length) {
    throw new Error(`Malformed defect record (missing: ${[...missing, !defectType && "defectType", !harm && "harm"].filter(Boolean).join(", ")})`);
  }
  const text = Object.fromEntries(fields.map((f) => [f, raw[f] as string])) as Record<(typeof fields)[number], string>;
  return { verdict: "defect", defectType, harm, ...text };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function compilePrArtifact(
  scenario: Scenario,
  defect: Extract<DefectRecord, { verdict: "defect" }>,
  draft: RewriteDraft,
): PrArtifact {
  return {
    ...draft,
    unifiedDiff: createTwoFilesPatch(
      `a/${scenario.docPath}`,
      `b/${scenario.docPath}`,
      scenario.publicMarkdown,
      draft.rewrittenMarkdown,
      undefined,
      undefined,
      { headerOptions: FILE_HEADERS_ONLY },
    ),
    jsonLd: buildJsonLd(draft),
    branchName: `aeo/fix-${slug(`${scenario.id} ${defect.defectType}`)}`,
  };
}

function offersFromPriceTableRows(markdown: string) {
  return markdown.split("\n").flatMap((line) => {
    if (!line.trim().startsWith("|")) return [];
    const [name, ...rest] = line.split("|").map((c) => c.trim()).filter(Boolean);
    const price = rest.join(" ").match(/\$([\d,]+(?:\.\d+)?)/);
    return price ? [{ "@type": "Offer", name: name.replace(/\*/g, ""), price: price[1].replace(/,/g, ""), priceCurrency: "USD" }] : [];
  });
}

function buildJsonLd(draft: RewriteDraft): Record<string, unknown>[] {
  const offers = offersFromPriceTableRows(draft.rewrittenMarkdown);
  return [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: draft.faq.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: draft.productName,
      ...(offers.length ? { offers } : {}),
    },
  ];
}

function orchestratorBrief(scenario: Scenario): string {
  return `Audit ${scenario.docPath} for ${scenario.company}.
Buyer question: ${scenario.buyerQuestion}
Ground-truth rules:
${rulesBlock(scenario.groundTruthRules)}
Call the tools to extract ground truth, simulate the buyer's answer, diagnose any defect, and compile the remediation patch.`;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runAgent(scenario: Scenario, port: ModelPort, emit: (e: AgentEvent) => void): Promise<void> {
  const runStarted = Date.now();
  const ctx: RunContext = { scenario, port, outputs: {} };
  const history: Content[] = [{ role: "user", parts: [{ text: orchestratorBrief(scenario) }] }];
  emit({ type: "run_start", mode: port.mode, model: port.modelId, scenarioId: scenario.id });

  for (const { id } of STEPS) {
    if (id === "generate_pr_artifact" && ctx.outputs.verify_causal_harm?.verdict === "no_defect") {
      emit({ type: "step_skipped", step: id, reason: "No defect found: nothing to remediate." });
      emit({ type: "run_done", outcome: "no_defect", ms: Date.now() - runStarted });
      return;
    }

    let call;
    try {
      call = await port.callTool(id, history);
    } catch (e) {
      emit({ type: "run_error", message: `Orchestrator turn for ${id} failed: ${errorMessage(e)}` });
      return;
    }
    if (call.name !== id) {
      emit({ type: "run_error", message: `Orchestrator called ${call.name}, expected ${id}` });
      return;
    }

    emit({ type: "step_start", step: id, args: call.args });
    const started = Date.now();
    const executor = EXECUTORS[id] as Executor<StepId>;
    try {
      const output = await executor.run(ctx);
      (ctx.outputs as Record<StepId, unknown>)[id] = output;
      emit({ type: "step_done", step: id, output, ms: Date.now() - started } as AgentEvent);
      history.push(call.content, {
        role: "user",
        parts: [{ functionResponse: { id: call.id, name: id, response: { output: executor.toFunctionResponse(output) } } }],
      });
    } catch (e) {
      emit({ type: "step_error", step: id, message: errorMessage(e), ms: Date.now() - started });
      return;
    }
  }
  emit({ type: "run_done", outcome: "patched", ms: Date.now() - runStarted });
}
