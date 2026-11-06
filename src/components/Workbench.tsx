"use client";

import { diffLines } from "diff";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import type { BuyerSynthesis, DefectRecord, HarmLevel, PrArtifact, Scenario } from "@/lib/domain";
import { outputOf, type RunState } from "@/lib/run-state";

const TABS = ["Defect Ticket", "Diff", "JSON-LD", "Export"] as const;
type Tab = (typeof TABS)[number];
type Defect = Extract<DefectRecord, { verdict: "defect" }>;

const HARM_TONE: Record<HarmLevel, string> = {
  Critical: "border-critical/60 bg-critical/10 text-critical",
  High: "border-high/60 bg-high/10 text-high",
  Medium: "border-medium/60 bg-medium/10 text-medium",
  Low: "border-low/60 bg-low/10 text-low",
};

export function Workbench({ state, scenario }: { state: RunState; scenario: Scenario | null }) {
  const [tab, setTab] = useState<Tab>("Defect Ticket");
  const synthesis = outputOf(state, "test_buyer_prompt");
  const record = outputOf(state, "verify_causal_harm");
  const pr = outputOf(state, "generate_pr_artifact");
  const ready: Record<Tab, boolean> = { "Defect Ticket": !!record, Diff: !!pr, "JSON-LD": !!pr, Export: !!pr };

  return (
    <div className="flex flex-col">
      <div role="tablist" className="flex flex-wrap border-b border-line px-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs whitespace-nowrap uppercase tracking-[0.12em] transition-colors ${
              tab === t ? "border-accent text-fg" : "border-transparent text-dim hover:text-fg"
            }`}
          >
            {t}
            <span className={`size-1.5 rounded-full ${ready[t] ? "bg-add" : "bg-line-strong"}`} aria-hidden />
          </button>
        ))}
      </div>
      <div className="p-4">
        {!scenario || !ready[tab] ? (
          <Empty tab={tab} state={state} />
        ) : tab === "Defect Ticket" && record ? (
          <Ticket scenario={scenario} synthesis={synthesis} record={record} />
        ) : tab === "Diff" && pr ? (
          <DiffView before={scenario.publicMarkdown} after={pr.rewrittenMarkdown} path={scenario.docPath} />
        ) : tab === "JSON-LD" && pr ? (
          <pre className="overflow-x-auto rounded-sm border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-fg">
            {JSON.stringify(pr.jsonLd, null, 2)}
          </pre>
        ) : tab === "Export" && pr && record?.verdict === "defect" ? (
          <Export scenario={scenario} synthesis={synthesis} defect={record} pr={pr} />
        ) : null}
      </div>
    </div>
  );
}

function Empty({ tab, state }: { tab: Tab; state: RunState }) {
  const skipped = state.steps.generate_pr_artifact.status === "skipped" && tab !== "Defect Ticket";
  return (
    <p className="font-mono text-xs leading-relaxed text-faint">
      {skipped
        ? "No defect was found, so no patch was compiled."
        : state.run.phase === "idle"
          ? "Run an audit to populate the workbench."
          : state.run.phase === "error"
            ? "The run failed before this artifact was produced."
            : "Waiting for the agent…"}
    </p>
  );
}

function Ticket({ scenario, synthesis, record }: { scenario: Scenario; synthesis: BuyerSynthesis | null; record: DefectRecord }) {
  if (record.verdict === "no_defect") {
    return (
      <div className="flex flex-col gap-3">
        <span className="w-fit rounded-sm border border-add/50 bg-add/10 px-2 py-0.5 font-mono text-xs text-add">NO DEFECT</span>
        <Row label="Buyer question">{scenario.buyerQuestion}</Row>
        {synthesis && <Row label="Answer engine said">{synthesis.answer}</Row>}
        <Row label="Rationale">{record.rationale}</Row>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-sm border px-2 py-0.5 font-mono text-xs font-medium ${HARM_TONE[record.harm]}`}>
          {record.harm.toUpperCase()}
        </span>
        <span className="rounded-sm border border-line-strong px-2 py-0.5 font-mono text-xs text-fg">{record.defectType}</span>
        <span className="font-mono text-[11px] text-faint">{scenario.docPath}</span>
      </div>
      <Row label="Buyer question">{scenario.buyerQuestion}</Row>
      {synthesis && (
        <Row label="Hallucinated answer">
          <blockquote className="border-l-2 border-critical/60 pl-3 text-fg">{synthesis.answer}</blockquote>
        </Row>
      )}
      <Row label="False statement">{record.hallucinatedStatement}</Row>
      <Row label="Violated rule">{record.violatedRule}</Row>
      <Row label="Root-cause excerpt">
        <code className="block rounded-sm border border-del/40 bg-del/[0.07] px-2.5 py-1.5 font-mono text-[11px] break-words whitespace-pre-wrap text-del">
          {record.rootCauseExcerpt}
        </code>
      </Row>
      <Row label="Why it happened">{record.rootCauseExplanation}</Row>
      <Row label="Acceptance test">{record.acceptanceTest}</Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <div className="text-sm leading-relaxed text-dim">{children}</div>
    </div>
  );
}

type Cell = { n: number; text: string; kind: "same" | "del" | "add" } | null;
type DiffRow = { left: Cell; right: Cell } | { fold: number };

const CONTEXT = 3;

function sideBySide(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let l = 1;
  let r = 1;
  const changes = diffLines(before, after);
  const linesOf = (v: string) => v.replace(/\n$/, "").split("\n");
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (!c.added && !c.removed) {
      const lines = linesOf(c.value);
      const keep = (j: number) => (i > 0 && j < CONTEXT) || (i < changes.length - 1 && j >= lines.length - CONTEXT);
      let folded = 0;
      lines.forEach((text, j) => {
        if (keep(j)) {
          if (folded) rows.push({ fold: folded });
          folded = 0;
          rows.push({ left: { n: l, text, kind: "same" }, right: { n: r, text, kind: "same" } });
        } else folded++;
        l++;
        r++;
      });
      if (folded) rows.push({ fold: folded });
      continue;
    }
    const removed = c.removed ? linesOf(c.value) : [];
    const next = changes[i + 1];
    const added = c.added ? linesOf(c.value) : next?.added ? linesOf(next.value) : [];
    if (c.removed && next?.added) i++;
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      rows.push({
        left: j < removed.length ? { n: l++, text: removed[j], kind: "del" } : null,
        right: j < added.length ? { n: r++, text: added[j], kind: "add" } : null,
      });
    }
  }
  return rows;
}

const CELL_TONE = { same: "text-dim", del: "bg-del/10 text-del", add: "bg-add/10 text-add" } as const;

function DiffCell({ cell, side }: { cell: Cell; side: "a" | "b" }) {
  if (!cell) return <div className="col-span-2 bg-raised/60" />;
  const mark = cell.kind === "same" ? " " : side === "a" ? "-" : "+";
  return (
    <>
      <span className={`px-2 text-right text-faint select-none ${cell.kind !== "same" ? CELL_TONE[cell.kind] : ""}`}>{cell.n}</span>
      <span className={`min-w-0 pr-2 break-words whitespace-pre-wrap ${CELL_TONE[cell.kind]}`}>
        <span className="select-none opacity-60">{mark} </span>
        {cell.text}
      </span>
    </>
  );
}

function DiffView({ before, after, path }: { before: string; after: string; path: string }) {
  const rows = sideBySide(before, after);
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-canvas font-mono text-[11px] leading-relaxed">
      <div className="grid grid-cols-2 border-b border-line text-faint">
        <span className="truncate px-3 py-1.5">a/{path}</span>
        <span className="truncate border-l border-line px-3 py-1.5">b/{path}</span>
      </div>
      {rows.map((row, i) =>
        "fold" in row ? (
          <div key={i} className="border-y border-line/60 bg-raised px-3 py-0.5 text-center text-faint">
            ⋯ {row.fold} unchanged line{row.fold === 1 ? "" : "s"}
          </div>
        ) : (
          <div key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)]">
            <DiffCell cell={row.left} side="a" />
            <DiffCell cell={row.right} side="b" />
          </div>
        ),
      )}
    </div>
  );
}

const patchFileName = (branch: string) => `${branch.replaceAll("/", "-")}.patch`;

function prBody(scenario: Scenario, synthesis: BuyerSynthesis | null, d: Defect, pr: PrArtifact): string {
  const quote = (s: string) => s.split("\n").map((l) => `> ${l}`).join("\n");
  return `# ${pr.prTitle}

## Defect

**${d.defectType}**, harm **${d.harm}**, in \`${scenario.docPath}\`.

**Buyer question:** ${scenario.buyerQuestion}

**Answer engine said:**
${quote(synthesis?.answer ?? d.hallucinatedStatement)}

**Violated rule:** ${d.violatedRule}

**Root cause:**
${quote(d.rootCauseExcerpt)}

${d.rootCauseExplanation}

## Fix

Answer-first rewrite of \`${scenario.docPath}\`, plus FAQPage and Product JSON-LD.

## Acceptance test

${d.acceptanceTest}

## Verification

${pr.verificationCheck}
`;
}

const ldScripts = (jsonLd: Record<string, unknown>[]) =>
  jsonLd
    .map((o) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, "\\u003c")}\n</script>`)
    .join("\n");

function Export({ scenario, synthesis, defect, pr }: { scenario: Scenario; synthesis: BuyerSynthesis | null; defect: Defect; pr: PrArtifact }) {
  const file = patchFileName(pr.branchName);
  const download = () => {
    const url = URL.createObjectURL(new Blob([pr.unifiedDiff], { type: "text/x-diff" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: file });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-dim">
        Nothing is written to GitHub. Download the patch and apply it on branch{" "}
        <code className="font-mono text-fg">{pr.branchName}</code>.
      </p>
      <ExportRow title={file} detail={`${pr.unifiedDiff.split("\n").length} lines, unified diff`}>
        <ActionButton onClick={download} icon={Download} label="Download" />
      </ExportRow>
      <CopyRow title="git apply command" text={`git checkout -b ${pr.branchName} && git apply ${file}`} />
      <CopyRow title="PR title + body" text={prBody(scenario, synthesis, defect, pr)} />
      <CopyRow title="JSON-LD <script> snippet" text={ldScripts(pr.jsonLd)} />
    </div>
  );
}

function ExportRow({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-line bg-panel px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-fg">{title}</div>
        <div className="truncate font-mono text-[11px] text-faint">{detail}</div>
      </div>
      {children}
    </div>
  );
}

function CopyRow({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <ExportRow title={title} detail={text.split("\n")[0]}>
      <ActionButton onClick={copy} icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} />
    </ExportRow>
  );
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof Copy; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1.5 text-xs text-fg transition-colors hover:border-accent/60 hover:text-accent"
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
