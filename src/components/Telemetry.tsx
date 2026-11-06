"use client";

import { ChevronRight, CircleAlert, CircleCheck, CircleDashed, CircleMinus, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { StepState } from "@/lib/domain";
import type { RunState } from "@/lib/run-state";
import { STEPS, type StepDef } from "@/lib/steps";

const STATUS_STYLE: Record<StepState["status"], { icon: typeof CircleCheck; tone: string; label: string }> = {
  pending: { icon: CircleDashed, tone: "text-faint", label: "pending" },
  running: { icon: LoaderCircle, tone: "text-accent", label: "running" },
  done: { icon: CircleCheck, tone: "text-add", label: "done" },
  error: { icon: CircleAlert, tone: "text-critical", label: "error" },
  skipped: { icon: CircleMinus, tone: "text-dim", label: "skipped" },
};

export function Telemetry({ state }: { state: RunState }) {
  const { run } = state;
  return (
    <div className="flex flex-col gap-3 p-4">
      <RunBanner state={state} />
      <ol className="relative flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <StepNode key={step.id} index={i + 1} step={step} state={state.steps[step.id]} />
        ))}
      </ol>
      {run.phase === "idle" && (
        <p className="font-mono text-xs leading-relaxed text-faint">
          Four forced Gemini function calls run in order. Each node shows the arguments the orchestrator chose and the tool output.
        </p>
      )}
    </div>
  );
}

function RunBanner({ state: { run, engine } }: { state: RunState }) {
  const engineText = engine ? `${engine.mode} · ${engine.model}` : "no run yet";
  const message =
    run.phase === "idle"
      ? "idle"
      : run.phase === "running"
        ? "running"
        : run.phase === "done"
          ? `${run.outcome === "patched" ? "patched" : "no defect found"} in ${(run.ms / 1000).toFixed(1)}s`
          : "failed";
  const tone =
    run.phase === "error" ? "border-critical/50 text-critical" : run.phase === "done" ? "border-add/40 text-add" : "border-line text-dim";
  return (
    <div className={`rounded-sm border px-3 py-2 font-mono text-[11px] ${tone}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <span>run: {message}</span>
        <span className="text-faint">{engineText}</span>
      </div>
      {run.phase === "error" && <p className="mt-1.5 break-words text-fg">{run.message}</p>}
    </div>
  );
}

function StepNode({ index, step, state }: { index: number; step: StepDef; state: StepState }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLE[state.status];
  const Icon = style.icon;
  const active = state.status === "running";

  return (
    <li
      className={`rounded-sm border bg-panel transition-colors ${
        active ? "border-accent/60" : state.status === "error" ? "border-critical/50" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="mt-0.5 font-mono text-[11px] text-faint">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm break-words text-fg">{step.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[11px]">
            <span className="text-faint">fn {step.id}</span>
            <span className={`flex items-center gap-1.5 ${style.tone}`}>
              <Icon className={`size-3.5 ${active ? "animate-spin" : ""}`} aria-hidden />
              {style.label}
              {state.status === "running" && <Elapsed startedAt={state.startedAt} />}
              {(state.status === "done" || state.status === "error") && <span className="text-dim">{state.ms}ms</span>}
            </span>
          </div>
          <p className="mt-1 text-xs text-dim">{step.summary}</p>
        </div>
      </div>

      {active && <div className="pulse-line mx-3 h-px bg-accent" aria-hidden />}

      {"args" in state && (
        <div className="border-t border-line px-3 py-2">
          <Label>args (model-chosen)</Label>
          <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px]">
            {Object.entries(state.args).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-dim">{k}</dt>
                <dd className="break-words text-fg">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {state.status === "error" && (
        <p className="border-t border-line px-3 py-2 font-mono text-[11px] break-words text-critical">{state.message}</p>
      )}
      {state.status === "skipped" && <p className="border-t border-line px-3 py-2 font-mono text-[11px] text-dim">{state.reason}</p>}

      {state.status === "done" && (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-raised"
          >
            <ChevronRight className={`size-3.5 text-dim transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
            <Label>output</Label>
          </button>
          {open && (
            <pre className="max-h-80 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-dim">
              {JSON.stringify(state.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{children}</span>;
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums text-fg">{((now - startedAt) / 1000).toFixed(1)}s</span>;
}
