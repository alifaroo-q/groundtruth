// Usage: node scripts/check.mjs [baseUrl]. Runs every fixture through POST /api/agent/run and checks the stream.
import assert from "node:assert/strict";
import { applyPatch, parsePatch } from "diff";
import { FIXTURES } from "../src/fixtures/scenarios.ts";
import { STEP_IDS } from "../src/lib/domain.ts";
import { STEPS } from "../src/lib/steps.ts";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/agent/run`;
const EXPECTED = {
  cloudpulse: { defectType: "False Claim", harm: "Critical", tier: "Enterprise" },
  relaywave: { defectType: "Omitted Condition", tier: "Growth" },
  ledgerline: { defectType: "Broken Route", tier: "Business" },
};

async function run(scenario) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  assert.equal(res.status, 200, `POST ${scenario.id} status`);
  assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop();
    for (const frame of frames) {
      const data = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (data) events.push(JSON.parse(data));
    }
  }
  assert.equal(buffer.trim(), "", "stream ends on a frame boundary");
  return events;
}

function answerFirstHeading(diff, rewritten, tier) {
  const added = new Set(parsePatch(diff)[0].hunks.flatMap((h) => h.lines).filter((l) => l.startsWith("+")).map((l) => l.slice(1)));
  const lines = rewritten.split("\n");
  return lines.some((line, i) => {
    if (!/^#{2,3} /.test(line) || !added.has(line)) return false;
    const next = lines.slice(i + 1).find((l) => l.trim());
    return next?.includes(tier);
  });
}

assert.deepEqual(STEPS.map((s) => s.id), [...STEP_IDS], "STEPS registry follows STEP_IDS order");

let mode;
for (const { scenario } of FIXTURES) {
  const events = await run(scenario);
  const types = events.map((e) => e.type);
  const start = events[0];
  assert.equal(start.type, "run_start", `${scenario.id}: first event is run_start (got ${JSON.stringify(start)})`);
  mode = start.mode;
  assert.ok(!types.includes("run_error") && !types.includes("step_error"), `${scenario.id}: no errors: ${JSON.stringify(events.filter((e) => e.type.endsWith("error")))}`);

  const starts = events.filter((e) => e.type === "step_start").map((e) => e.step);
  const done = events.filter((e) => e.type === "step_done");
  const finish = events.at(-1);
  assert.equal(finish.type, "run_done", `${scenario.id}: last event is run_done`);
  for (const d of done) assert.ok(Number.isFinite(d.ms) && d.ms >= 0, `${scenario.id}: ${d.step} ms is numeric`);

  const verdict = done.find((d) => d.step === "verify_causal_harm").output;
  if (verdict.verdict === "no_defect") {
    assert.deepEqual(starts, STEP_IDS.slice(0, 3), `${scenario.id}: 3 step_start in order`);
    assert.ok(events.some((e) => e.type === "step_skipped" && e.step === "generate_pr_artifact"), `${scenario.id}: patch step skipped`);
    assert.equal(finish.outcome, "no_defect");
    console.log(`ok   ${scenario.id}: no_defect, ${events.length} events`);
    continue;
  }

  assert.deepEqual(starts, [...STEP_IDS], `${scenario.id}: 4 step_start in STEPS order`);
  assert.equal(finish.outcome, "patched");
  const expected = EXPECTED[scenario.id];
  assert.equal(verdict.defectType, expected.defectType, `${scenario.id}: defect type`);
  if (expected.harm) assert.equal(verdict.harm, expected.harm, `${scenario.id}: harm`);
  assert.ok(scenario.publicMarkdown.includes(verdict.rootCauseExcerpt), `${scenario.id}: rootCauseExcerpt is verbatim`);

  const pr = done.find((d) => d.step === "generate_pr_artifact").output;
  assert.equal(applyPatch(scenario.publicMarkdown, pr.unifiedDiff), pr.rewrittenMarkdown, `${scenario.id}: patch applies to the original`);
  assert.ok(pr.unifiedDiff.startsWith(`--- a/${scenario.docPath}`), `${scenario.id}: diff header names a/${scenario.docPath}`);
  assert.match(pr.branchName, /^aeo\/fix-[a-z0-9-]+$/, `${scenario.id}: branch name`);
  for (const ld of pr.jsonLd) {
    assert.deepEqual(JSON.parse(JSON.stringify(ld)), ld, `${scenario.id}: JSON-LD round-trips`);
    assert.equal(ld["@context"], "https://schema.org");
    assert.ok(["FAQPage", "Product"].includes(ld["@type"]), `${scenario.id}: @type ${ld["@type"]}`);
  }
  assert.ok(
    answerFirstHeading(pr.unifiedDiff, pr.rewrittenMarkdown, expected.tier),
    `${scenario.id}: an added H2/H3 is followed by a line naming ${expected.tier}`,
  );
  const offers = pr.jsonLd.find((ld) => ld["@type"] === "Product").offers ?? [];
  console.log(
    `ok   ${scenario.id}: ${start.mode}, ${verdict.defectType}/${verdict.harm}, steps ${done.map((d) => `${d.step}=${d.ms}ms`).join(" ")}, ` +
      `diff ${pr.unifiedDiff.split("\n").length} lines, ${offers.length} offers, branch ${pr.branchName}`,
  );
}

const bad = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
assert.equal(bad.status, 400, "malformed body is rejected with 400");
console.log("ok   malformed body: 400");

if (mode === "replay") {
  const edited = { ...FIXTURES[0].scenario, buyerQuestion: `${FIXTURES[0].scenario.buyerQuestion} Asking for a hospital.` };
  const events = await run(edited);
  assert.deepEqual(events.map((e) => e.type), ["run_error"], "edited input yields only run_error in replay");
  assert.match(events[0].message, /Edited input needs a live model: set GEMINI_API_KEY in \.env\.local/);
  console.log(`ok   edited input in replay: run_error "${events[0].message}"`);
} else {
  console.log("skip edited-input check: server is in live mode");
}
console.log("all checks passed");
