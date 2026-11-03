/* web_search prints "1. title / url / snippet". This reads that back into
   data so it can be shown as a list. Pure, no fetching. */

export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
}

const ITEM = /^\s*(\d+)\.\s*(.*)$/;

export function parseResults(text: unknown): SearchItem[] | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const items: SearchItem[] = [];
  let current: SearchItem | null = null;

  for (const line of text.split("\n")) {
    const start = ITEM.exec(line);
    if (start) {
      if (current) items.push(current);
      current = { title: start[2].trim(), url: "", snippet: "" };
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!current.url && /^https?:\/\//.test(trimmed)) current.url = trimmed;
    else current.snippet += (current.snippet ? " " : "") + trimmed;
  }
  if (current) items.push(current);

  const usable = items.filter((i) => i.url);
  return usable.length ? usable : null;
}
