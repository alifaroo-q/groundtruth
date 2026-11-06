# GroundTruth

GroundTruth finds where a SaaS docs page makes AI answer engines give buyers wrong answers. It ends in a patch that fixes the page. One button runs four Gemini function calls in a fixed order: `parse_doc_claims`, `test_buyer_prompt`, `verify_causal_harm`, `generate_pr_artifact`. The result is a defect ticket, a unified diff, and JSON-LD.

## Run

```bash
npm install
cp .env.local.example .env.local   # add GEMINI_API_KEY for live mode
npm run dev
```

Without a key, the app runs in replay mode on the three fixtures, and a badge says so. Replay outputs are hand-written samples. The diff and JSON-LD are still computed in code. In replay mode, an edited input is rejected.

## Check

```bash
npm run check -- http://localhost:3000
```

The check posts each fixture to `/api/agent/run` and asserts the following:

- The four steps run in order.
- The patch applies cleanly to the original doc.
- The JSON-LD is valid.
- The new H2 or H3 states the tier condition.

## Layout

- `src/lib/domain.ts` defines the data contract.
- `src/lib/steps.ts` is the step registry. It feeds the Gemini declarations and the telemetry nodes.
- `src/lib/agent.ts` holds the orchestrator loop and tool executors.
- `src/lib/model.ts` holds the live Gemini port and the replay port.
- `src/fixtures/scenarios.ts` holds the three demo scenarios.
