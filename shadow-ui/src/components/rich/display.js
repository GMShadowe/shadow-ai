import { parseResults } from "./searchParse.js";

/* Turns a finished tool call into the data a card draws, or null.

   show_list and show_chart: the card is drawn from the arguments the model
   passed - the same data the brain checked (tools/display.py) - never from
   the reply text. show_images: from the result, whose first line is JSON
   the brain built from the search. A call the brain refused (Error,
   Blocked) draws nothing; the tool row says why instead. */

export const DISPLAY_TOOLS = new Set(["show_list", "show_chart", "show_images"]);

const REFUSED = /^(Error|Blocked|Internal error|No pictures)/;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value ?? "").replace(/[,\s%$€£₹]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Models write units out ("percent", "USD billions"); a chart label wants them short.
function unitOf(unit) {
  const u = clean(unit);
  return /^(percent(age)?|per ?cent|pct)$/i.test(u) ? "%" : u;
}

function listPanel(args) {
  const items = asArray(args.items)
    .map((item) =>
      item && typeof item === "object"
        ? { title: clean(item.title), detail: clean(item.detail) }
        : { title: clean(item), detail: "" }
    )
    .filter((item) => item.title)
    .slice(0, 30);
  return items.length ? { kind: "list", title: clean(args.title) || "List", items } : null;
}

function chartPanel(args) {
  const labels = asArray(args.labels);
  const values = asArray(args.values);
  if (!labels.length || labels.length !== values.length) return null;
  const points = labels.map((label, i) => ({ label: clean(label), value: asNumber(values[i]) })).slice(0, 24);
  if (points.some((p) => p.value === null)) return null;
  return {
    kind: "chart",
    chart: args.kind === "line" ? "line" : "bar",
    title: clean(args.title) || "Chart",
    unit: unitOf(args.unit),
    points,
  };
}

function imagesPanel(args, result) {
  try {
    const images = JSON.parse(result.split("\n", 1)[0]).images ?? [];
    const usable = images.filter((i) => typeof i.thumb === "string" && i.thumb.startsWith("https://"));
    return usable.length ? { kind: "images", title: clean(args.query) || "Pictures", images: usable } : null;
  } catch {
    return null;
  }
}

export function panelFor(call) {
  if (!call || call.kind === "permission" || call.result === null || call.result === undefined) return null;
  const result = String(call.result);
  if (REFUSED.test(result)) return null;
  const args = call.args ?? {};
  if (call.name === "show_list") return listPanel(args);
  if (call.name === "show_chart") return chartPanel(args);
  if (call.name === "show_images") return imagesPanel(args, result);
  return null;
}

/* What the voice screen puts in the middle for a reply: the last thing
   Shadow chose to show, or else the search it ran, as a list. */
export function stagePanel(message) {
  const tools = message?.tools ?? [];
  for (let i = tools.length - 1; i >= 0; i--) {
    const panel = panelFor(tools[i]);
    if (panel) return panel;
  }
  const search = [...tools].reverse().find((t) => t.name === "web_search" && t.result);
  const results = search ? parseResults(String(search.result)) : null;
  if (!results) return null;
  return {
    kind: "list",
    title: `Results for “${clean(search.args?.query)}”`,
    items: results.map((r) => ({ title: r.title, detail: hostOf(r.url), href: r.url })),
  };
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
