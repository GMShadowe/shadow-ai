/* Repair a table the model *nearly* got right.

   GFM only accepts a table if the delimiter row has one valid cell per
   header cell. Miss that by a character and remark renders the whole thing
   as a paragraph of pipes. A 4B writing `| :--- | :--- | :--- | : |` is
   enough to lose it, and that is exactly what happened in testing.

   So the delimiter row is normalised before parsing. Nothing else is
   touched, and a correct table passes through unchanged. */

const DELIMITER_LINE = /^[\s|:-]+$/;

function cells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function fixCell(cell: string): string {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":") && cell.length > 1;
  if (left && right) return ":---:";
  if (left) return ":---";
  if (right) return "---:";
  return "---";
}

export function repairTables(text: string): string {
  if (typeof text !== "string" || !text.includes("|")) return text;
  const lines = text.split("\n");
  let changed = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Only pipes, dashes, colons and spaces, with at least one dash or colon.
    if (!line.includes("|") || !DELIMITER_LINE.test(line) || !/[-:]/.test(line)) continue;
    const header = lines[i - 1];
    if (!header.includes("|") || !header.trim()) continue;

    const want = cells(header).length;
    if (want < 1) continue;
    const have = cells(line).map(fixCell);
    while (have.length < want) have.push("---");
    have.length = want;

    const repaired = `| ${have.join(" | ")} |`;
    if (repaired !== line.trim()) {
      lines[i] = repaired;
      changed = true;
    }
  }

  return changed ? lines.join("\n") : text;
}
