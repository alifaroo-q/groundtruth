// Answer engines answer from a few retrieved passages, not the whole page. A condition worded
// without the buyer's vocabulary never reaches the model, which is the defect this app hunts.

const STOPWORDS = new Set(
  "a an and any are at be can do does for from how i in is it its my of on or our the there this to what where which with you your".split(" "),
);

function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

export function chunkMarkdown(markdown: string): string[] {
  const passages: string[] = [];
  let heading = "";
  for (const block of markdown.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    if (lines[0]?.startsWith("#")) heading = lines.shift()!.replace(/^#+\s*/, "");
    const body = lines.join("\n").trim();
    if (body) passages.push(heading ? `## ${heading}\n${body}` : body);
  }
  return passages;
}

export function retrievePassages(markdown: string, query: string, k = 3): string[] {
  const passages = chunkMarkdown(markdown).map((text) => ({ text, terms: terms(text) }));
  const df = new Map<string, number>();
  for (const p of passages) for (const t of p.terms) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + passages.length / (df.get(t) ?? passages.length));
  const queryTerms = [...terms(query)];
  return passages
    .map((p, i) => ({ ...p, i, score: queryTerms.reduce((s, t) => s + (p.terms.has(t) ? idf(t) : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, k)
    .sort((a, b) => a.i - b.i)
    .map((p) => p.text);
}
