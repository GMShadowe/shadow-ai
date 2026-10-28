/* Repair a table the model *nearly* got right.

   GFM only accepts a table if the delimiter row has one valid cell per
   header cell — each one at least one dash, optionally colon-anchored. Miss
   that by a character and remark doesn't render a slightly-wrong table, it
   renders the whole thing as a paragraph of pipes. A 4B writing
   `| :--- | :--- | :--- | : |` is enough to lose it, and that is exactly
   what happened in testing.

   So the delimiter row is normalised before parsing: cells are rewritten to
   a valid form, and padded or trimmed to the header's count. Nothing else
   is touched — the repair is only ever applied to a row that is already
   trying to be a delimiter, and a correct table passes through unchanged. */

const DELIMITER_LINE = /^[\s|:-]+$/;

function cells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function fixCell(cell) {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":") && cell.length > 1;
  if (left && right) return ":---:";
  if (left) return ":---";
  if (right) return "---:";
  return "---";
}

export function repairTables(text) {
  if (typeof text !== "string" || !text.includes("|")) return text;
  const lines = text.split("\n");
  let changed = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // A delimiter row: only pipes, dashes, colons and spaces, and it has to
    // carry at least one dash or colon so a line of "|  |" isn't mistaken
    // for one.
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
