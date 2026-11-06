import { FunctionCallingConfigMode, GoogleGenAI, type Content } from "@google/genai";
import { FIXTURES, type Fixture } from "@/fixtures/scenarios";
import { DEFECT_TYPES, HARM_LEVELS, type ModelOutput, type RunMode, type Scenario, type StepId } from "./domain";
import { STEPS } from "./steps";

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  id?: string;
  /** The model turn to append to history verbatim; it may carry thought signatures. */
  content: Content;
};

export interface ModelPort {
  mode: RunMode;
  modelId: string;
  callTool(step: StepId, history: Content[]): Promise<ToolCall>;
  generate<S extends StepId>(step: S, prompt: string): Promise<ModelOutput[S]>;
}

const REPLAY_MODEL_ID = "hand-authored sample";

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

export function runtimeMode(): { mode: RunMode; modelId: string } {
  return apiKey()
    ? { mode: "live", modelId: process.env.GEMINI_MODEL || "gemini-2.5-flash" }
    : { mode: "replay", modelId: REPLAY_MODEL_ID };
}

export function createPort(scenario: Scenario): ModelPort | string {
  const key = apiKey();
  if (key) return livePort(key, runtimeMode().modelId);
  const fixture = FIXTURES.find((f) => sameScenario(f.scenario, scenario));
  return fixture ? replayPort(fixture) : "Edited input needs a live model: set GEMINI_API_KEY in .env.local";
}

function sameScenario(a: Scenario, b: Scenario): boolean {
  return (
    a.id === b.id &&
    a.docPath === b.docPath &&
    a.buyerQuestion === b.buyerQuestion &&
    a.publicMarkdown === b.publicMarkdown &&
    a.groundTruthRules.join("\n") === b.groundTruthRules.join("\n")
  );
}

const ORCHESTRATOR_INSTRUCTION =
  "You are GroundTruth, an Answer Engine Optimization defect-remediation agent. You run a fixed audit pipeline by calling the provided tools. " +
  "The server holds the full document text, ground-truth rules, and every prior tool output. Pass short references (doc paths) and one-line summaries as arguments, never full document text.";

function livePort(apiKey: string, modelId: string): ModelPort {
  const ai = new GoogleGenAI({ apiKey });
  return {
    mode: "live",
    modelId,
    async callTool(step, history) {
      const res = await ai.models.generateContent({
        model: modelId,
        contents: history,
        config: {
          systemInstruction: ORCHESTRATOR_INSTRUCTION,
          tools: [{ functionDeclarations: STEPS.map((s) => s.declaration) }],
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [step] },
          },
        },
      });
      const call = res.functionCalls?.[0];
      const content = res.candidates?.[0]?.content;
      if (!call || !content) throw new Error(`Orchestrator returned no function call for ${step}`);
      return { name: call.name ?? "", args: call.args ?? {}, id: call.id, content };
    },
    async generate(step, prompt) {
      const res = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: OUTPUT_SCHEMAS[step] },
      });
      if (!res.text) throw new Error(`${step}: model returned an empty response`);
      return JSON.parse(res.text);
    },
  };
}

const sleep = (min: number, max: number) =>
  new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

function replayPort(fixture: Fixture): ModelPort {
  return {
    mode: "replay",
    modelId: REPLAY_MODEL_ID,
    async callTool(step) {
      await sleep(150, 350);
      const args = fixture.replay.args[step];
      return { name: step, args, content: { role: "model", parts: [{ functionCall: { name: step, args } }] } };
    },
    async generate(step) {
      await sleep(500, 1150);
      return structuredClone(fixture.replay.outputs[step]);
    },
  };
}

const str = { type: "string" };
const strings = { type: "array", items: str };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
});

const OUTPUT_SCHEMAS: Record<StepId, unknown> = {
  parse_doc_claims: object({
    claims: {
      type: "array",
      items: object({
        text: str,
        section: str,
        status: { type: "string", enum: ["explicit", "buried", "contradicted", "missing"] },
        relatedRule: { type: "string", description: "Exact text of the related rule, or an empty string." },
      }),
    },
    buriedOrMissingConditions: strings,
  }),
  test_buyer_prompt: object({ answer: str, citedPassages: strings }),
  verify_causal_harm: object(
    {
      verdict: { type: "string", enum: ["defect", "no_defect"] },
      defectType: { type: "string", enum: [...DEFECT_TYPES] },
      harm: { type: "string", enum: [...HARM_LEVELS] },
      hallucinatedStatement: str,
      violatedRule: str,
      rootCauseExcerpt: str,
      rootCauseExplanation: str,
      acceptanceTest: str,
      rationale: str,
    },
    ["verdict"],
  ),
  generate_pr_artifact: object({
    rewrittenMarkdown: str,
    faq: { type: "array", items: object({ question: str, answer: str }) },
    productName: str,
    prTitle: str,
    verificationCheck: str,
  }),
};
