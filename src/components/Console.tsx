"use client";

import { FlaskConical, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { useReducer, useState } from "react";
import type { AgentEvent, RunMode, Scenario } from "@/lib/domain";
import { initialRunState, runReducer, type RunAction } from "@/lib/run-state";
import { Telemetry } from "./Telemetry";
import { Workbench } from "./Workbench";

type Draft = { buyerQuestion: string; publicMarkdown: string; rulesText: string };

const draftOf = (s: Scenario): Draft => ({
  buyerQuestion: s.buyerQuestion,
  publicMarkdown: s.publicMarkdown,
  rulesText: s.groundTruthRules.join("\n"),
});

const parseRules = (text: string) => text.split("\n").map((r) => r.trim()).filter(Boolean);

async function streamRun(scenario: Scenario, dispatch: (a: RunAction) => void) {
  const res = await fetch("/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with ${res.status}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue;
      const event = JSON.parse(frame.slice(6)) as AgentEvent;
      finished ||= ["run_done", "run_error", "step_error"].includes(event.type);
      dispatch({ type: "event", event, at: Date.now() });
    }
  }
  if (!finished) throw new Error("Stream closed before the run finished");
}

export function Console({ mode, modelId, scenarios }: { mode: RunMode; modelId: string; scenarios: Scenario[] }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const fixture = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const [draft, setDraft] = useState(() => draftOf(scenarios[0]));
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [ranScenario, setRanScenario] = useState<Scenario | null>(null);

  const running = state.run.phase === "running";
  const edited =
    draft.buyerQuestion.trim() !== fixture.buyerQuestion ||
    draft.publicMarkdown !== fixture.publicMarkdown ||
    parseRules(draft.rulesText).join("\n") !== fixture.groundTruthRules.join("\n");

  const pick = (s: Scenario) => {
    setScenarioId(s.id);
    setDraft(draftOf(s));
  };

  const execute = async () => {
    const scenario: Scenario = {
      ...fixture,
      buyerQuestion: draft.buyerQuestion.trim(),
      publicMarkdown: draft.publicMarkdown,
      groundTruthRules: parseRules(draft.rulesText),
    };
    setRanScenario(scenario);
    dispatch({ type: "begin" });
    try {
      await streamRun(scenario, dispatch);
    } catch (e) {
      dispatch({ type: "transport_error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-medium tracking-tight text-fg">
            ground<span className="text-accent">truth</span>
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-faint">causal AEO audit</span>
        </div>
        <div className="ml-auto">
          <ModeBadge mode={mode} modelId={modelId} />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[19rem_minmax(0,1fr)_minmax(0,1.25fr)] xl:grid-cols-[23rem_minmax(0,1fr)_minmax(0,1.25fr)]">
        <Panel index="01" title="Input Trigger">
          <div className="flex flex-col gap-4 p-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs uppercase tracking-[0.14em] text-dim">Scenario</legend>
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={running}
                  onClick={() => pick(s)}
                  aria-pressed={s.id === scenarioId}
                  className={`group flex flex-col items-start rounded-sm border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                    s.id === scenarioId ? "border-accent/70 bg-accent/[0.06]" : "border-line hover:border-line-strong"
                  }`}
                >
                  <span className="text-sm font-medium text-fg">{s.company}</span>
                  <span className="text-xs text-dim">{s.name}</span>
                </button>
              ))}
            </fieldset>

            <Field label="Buyer question">
              <textarea
                rows={2}
                value={draft.buyerQuestion}
                onChange={(e) => setDraft({ ...draft, buyerQuestion: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Public doc" hint={fixture.docPath}>
              <textarea
                rows={14}
                spellCheck={false}
                value={draft.publicMarkdown}
                onChange={(e) => setDraft({ ...draft, publicMarkdown: e.target.value })}
                className={`${inputClass} text-[11px] leading-relaxed`}
              />
            </Field>

            <Field label="Ground-truth rules" hint="one per line">
              <textarea
                rows={6}
                spellCheck={false}
                value={draft.rulesText}
                onChange={(e) => setDraft({ ...draft, rulesText: e.target.value })}
                className={inputClass}
              />
            </Field>

            {edited && mode === "replay" && (
              <p className="flex gap-2 rounded-sm border border-medium/40 bg-medium/[0.06] px-3 py-2 text-xs text-medium">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Edited input cannot replay. Set GEMINI_API_KEY in .env.local to audit custom text.
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft(draftOf(fixture))}
                disabled={!edited || running}
                className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-2 text-xs text-dim transition-colors hover:border-line-strong hover:text-fg disabled:opacity-40 disabled:hover:border-line disabled:hover:text-dim"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset to fixture
              </button>
            </div>

            <button
              type="button"
              onClick={execute}
              disabled={running || !draft.buyerQuestion.trim() || !draft.publicMarkdown.trim() || !parseRules(draft.rulesText).length}
              className="flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-4" aria-hidden fill="currentColor" />
              {running ? "Audit running…" : "Execute Causal AEO Audit"}
            </button>
          </div>
        </Panel>

        <Panel index="02" title="Live Agent Telemetry">
          <Telemetry state={state} />
        </Panel>

        <Panel index="03" title="Artifact Workbench" last>
          <Workbench state={state} scenario={ranScenario} />
        </Panel>
      </main>
    </div>
  );
}

const inputClass =
  "w-full resize-y rounded-sm border border-line bg-canvas px-2.5 py-2 font-mono text-xs text-fg outline-none transition-colors placeholder:text-faint focus:border-accent/60";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2 text-xs uppercase tracking-[0.14em] text-dim">
        {label}
        {hint && <span className="truncate font-mono text-[11px] normal-case tracking-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Panel({ index, title, last, children }: { index: string; title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col border-line lg:min-h-0 ${last ? "" : "border-b lg:border-r lg:border-b-0"}`}>
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs uppercase tracking-[0.18em] text-dim">
        <span className="font-mono text-faint">{index}</span>
        {title}
      </h2>
      <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
    </section>
  );
}

function ModeBadge({ mode, modelId }: { mode: RunMode; modelId: string }) {
  if (mode === "live") {
    return (
      <span className="flex items-center gap-2 rounded-sm border border-accent/60 px-2.5 py-1 font-mono text-[11px] text-accent">
        <span className="size-1.5 rounded-full bg-accent pulse-line" aria-hidden />
        LIVE · {modelId}
      </span>
    );
  }
  return (
    <span className="hatch flex items-center gap-2 rounded-sm border border-medium/60 px-2.5 py-1 font-mono text-[11px] text-medium">
      <FlaskConical className="size-3.5" aria-hidden />
      REPLAY · no API key (hand-authored sample)
    </span>
  );
}
