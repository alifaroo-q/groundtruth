// Contract for the whole app. Server and client both import from here.

export type Scenario = {
  id: string;
  name: string;
  company: string;
  docPath: string;
  buyerQuestion: string;
  publicMarkdown: string;
  groundTruthRules: string[];
};

export const STEP_IDS = [
  "parse_doc_claims",
  "test_buyer_prompt",
  "verify_causal_harm",
  "generate_pr_artifact",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export type ClaimStatus = "explicit" | "buried" | "contradicted" | "missing";

export type ClaimsReport = {
  claims: { text: string; section: string; status: ClaimStatus; relatedRule: string | null }[];
  buriedOrMissingConditions: string[];
};

export type BuyerSynthesis = {
  answer: string;
  citedPassages: string[];
};

export const DEFECT_TYPES = ["False Claim", "Omitted Condition", "Broken Route"] as const;
export type DefectType = (typeof DEFECT_TYPES)[number];

export const HARM_LEVELS = ["Critical", "High", "Medium", "Low"] as const;
export type HarmLevel = (typeof HARM_LEVELS)[number];

export type DefectRecord =
  | {
      verdict: "defect";
      defectType: DefectType;
      harm: HarmLevel;
      hallucinatedStatement: string;
      violatedRule: string;
      /** Verbatim substring of publicMarkdown; the server rejects the record if it is not found. */
      rootCauseExcerpt: string;
      rootCauseExplanation: string;
      acceptanceTest: string;
    }
  | { verdict: "no_defect"; rationale: string };

/** What the model writes for step 4. Diff and JSON-LD are derived from it in code. */
export type RewriteDraft = {
  rewrittenMarkdown: string;
  faq: { question: string; answer: string }[];
  productName: string;
  prTitle: string;
  verificationCheck: string;
};

export type PrArtifact = RewriteDraft & {
  unifiedDiff: string;
  jsonLd: Record<string, unknown>[];
  branchName: string;
};

/** Model-produced output per step: what ModelPort.generate returns. */
export type ModelOutput = {
  parse_doc_claims: ClaimsReport;
  test_buyer_prompt: BuyerSynthesis;
  verify_causal_harm: DefectRecord;
  generate_pr_artifact: RewriteDraft;
};

/** Final tool result per step: what the telemetry node and the workbench render. */
export type StepOutput = {
  parse_doc_claims: ClaimsReport;
  test_buyer_prompt: BuyerSynthesis;
  verify_causal_harm: DefectRecord;
  generate_pr_artifact: PrArtifact;
};

export type RunMode = "live" | "replay";

export type AgentEvent =
  | { type: "run_start"; mode: RunMode; model: string; scenarioId: string }
  | { type: "step_start"; step: StepId; args: Record<string, unknown> }
  | { [S in StepId]: { type: "step_done"; step: S; output: StepOutput[S]; ms: number } }[StepId]
  | { type: "step_error"; step: StepId; message: string; ms: number }
  | { type: "step_skipped"; step: StepId; reason: string }
  | { type: "run_done"; outcome: "patched" | "no_defect"; ms: number }
  | { type: "run_error"; message: string };

export type StepState =
  | { status: "pending" }
  | { status: "running"; args: Record<string, unknown>; startedAt: number }
  | { status: "done"; args: Record<string, unknown>; output: unknown; ms: number }
  | { status: "error"; args: Record<string, unknown>; message: string; ms: number }
  | { status: "skipped"; reason: string };
