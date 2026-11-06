import type { FunctionDeclaration } from "@google/genai";
import type { StepId } from "./domain";

export type StepDef = {
  id: StepId;
  label: string;
  summary: string;
  declaration: FunctionDeclaration;
};

function declare(
  name: StepId,
  description: string,
  params: Record<string, string>,
): FunctionDeclaration {
  return {
    name,
    description,
    parametersJsonSchema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(params).map(([key, desc]) => [key, { type: "string", description: desc }]),
      ),
      required: Object.keys(params),
    },
  };
}

export const STEPS: StepDef[] = [
  {
    id: "parse_doc_claims",
    label: "extract_ground_truth()",
    summary: "Map every public claim in the doc against the ground-truth rules.",
    declaration: declare(
      "parse_doc_claims",
      "Extract the claims a public docs page makes and mark which ground-truth conditions are explicit, buried, contradicted, or missing.",
      {
        raw_markdown: "The doc path being audited. The server holds the full text; do not paste it.",
        ground_truth_rules: "One-line summary of the ground-truth rules to check against.",
      },
    ),
  },
  {
    id: "test_buyer_prompt",
    label: "simulate_buyer_synthesis()",
    summary: "Ask an unguided answer engine the buyer question using only the public page.",
    declaration: declare(
      "test_buyer_prompt",
      "Simulate an AI answer engine answering a buyer's question from the public page alone, with no access to ground truth.",
      {
        buyer_question: "The buyer's question, verbatim.",
        public_context: "The doc path the answer engine reads. The server supplies the text.",
      },
    ),
  },
  {
    id: "verify_causal_harm",
    label: "diagnose_causal_defect()",
    summary: "Judge the synthesized answer against ground truth and trace it to a doc excerpt.",
    declaration: declare(
      "verify_causal_harm",
      "Compare the answer engine's response to the ground-truth rules, classify any defect and its harm, and cite the exact doc passage that caused it.",
      {
        ai_answer: "One-line summary of the answer engine's response.",
        ground_truth_rules: "One-line summary of the rules the answer may violate.",
      },
    ),
  },
  {
    id: "generate_pr_artifact",
    label: "compile_remediation_patch()",
    summary: "Rewrite the doc answer-first and compile the patch and JSON-LD.",
    declaration: declare(
      "generate_pr_artifact",
      "Produce a focused, answer-first rewrite of the doc that fixes the defect, plus FAQ entries for structured data.",
      {
        defect_record: "One-line summary of the defect being fixed.",
        original_markdown: "The doc path being patched. The server holds the full text.",
      },
    ),
  },
];
