import { STEP_IDS, type AgentEvent, type RunMode, type StepId, type StepOutput, type StepState } from "./domain";

export type RunPhase =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; outcome: "patched" | "no_defect"; ms: number }
  | { phase: "error"; message: string };

export type RunState = {
  run: RunPhase;
  engine: { mode: RunMode; model: string } | null;
  steps: Record<StepId, StepState>;
};

export type RunAction =
  | { type: "begin" }
  | { type: "event"; event: AgentEvent; at: number }
  | { type: "transport_error"; message: string };

const pendingSteps = () =>
  Object.fromEntries(STEP_IDS.map((id) => [id, { status: "pending" }])) as Record<StepId, StepState>;

export const initialRunState: RunState = { run: { phase: "idle" }, engine: null, steps: pendingSteps() };

const argsOf = (s: StepState) => ("args" in s ? s.args : {});

export function runReducer(state: RunState, action: RunAction): RunState {
  if (action.type === "begin") return { ...initialRunState, steps: pendingSteps(), run: { phase: "running" } };
  if (action.type === "transport_error") return { ...state, run: { phase: "error", message: action.message } };

  const e = action.event;
  const setStep = (step: StepId, next: StepState) => ({ ...state, steps: { ...state.steps, [step]: next } });
  switch (e.type) {
    case "run_start":
      return { ...state, engine: { mode: e.mode, model: e.model } };
    case "step_start":
      return setStep(e.step, { status: "running", args: e.args, startedAt: action.at });
    case "step_done":
      return setStep(e.step, { status: "done", args: argsOf(state.steps[e.step]), output: e.output, ms: e.ms });
    case "step_error":
      return {
        ...setStep(e.step, { status: "error", args: argsOf(state.steps[e.step]), message: e.message, ms: e.ms }),
        run: { phase: "error", message: `${e.step} failed: ${e.message}` },
      };
    case "step_skipped":
      return setStep(e.step, { status: "skipped", reason: e.reason });
    case "run_done":
      return { ...state, run: { phase: "done", outcome: e.outcome, ms: e.ms } };
    case "run_error":
      return { ...state, run: { phase: "error", message: e.message } };
  }
}

export function outputOf<S extends StepId>(state: RunState, step: S): StepOutput[S] | null {
  const s = state.steps[step];
  return s.status === "done" ? (s.output as StepOutput[S]) : null;
}
