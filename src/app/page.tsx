import { connection } from "next/server";
import { Suspense } from "react";
import { Console } from "@/components/Console";
import { FIXTURES } from "@/fixtures/scenarios";
import { runtimeMode } from "@/lib/model";

// The mode depends on runtime env, so it must render per request, not into the static shell.
async function ModeAwareConsole() {
  await connection();
  const { mode, modelId } = runtimeMode();
  return <Console mode={mode} modelId={modelId} scenarios={FIXTURES.map((f) => f.scenario)} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center font-mono text-xs text-dim">loading console…</div>}>
      <ModeAwareConsole />
    </Suspense>
  );
}
