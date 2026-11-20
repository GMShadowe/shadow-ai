import type { Message, ToolEntry } from "@/types";
import { parseResults } from "./searchParse";

/* Turns a finished tool call into the data a card draws, or null.

   show_list and show_chart: drawn from the arguments the model passed - the
   same data the brain checked (tools/display.py) - never from the reply
   text. show_images: from the result, whose first line is JSON the brain
   built. A call the brain refused draws nothing; the tool row says why. */

export interface ListItem {
  title: string;
  detail: string;
  href?: string;
}
export interface ChartPoint {
  label: string;
  value: number;
}
export interface ImageItem {
  thumb: string;
  title?: string;
  page?: string;
  source?: string;
}

export type Panel =
  | { kind: "list"; title: string; items: ListItem[] }
  | { kind: "chart"; chart: "line" | "bar"; title: string; unit: string; points: ChartPoint[] }
  | { kind: "images"; title: string; images: ImageItem[] };

export const DISPLAY_TOOLS = new Set(["show_list", "show_chart", "show_images"]);

const REFUSED = /^(Error|Blocked|Internal error|No pictures)/;

function asArray(value: unknown): unknown[] {
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value ?? "").replace(/[,\s%$€£₹]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

// Models write units out ("percent"); a chart label wants them short.
function unitOf(unit: unknown) {
  const u = clean(unit);
  return /^(percent(age)?|per ?cent|pct)$/i.test(u) ? "%" : u;
}

function listPanel(args: Record<string, unknown>): Panel | null {
  const items = asArray(args.items)
    .map((item) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return { title: clean(o.title), detail: clean(o.detail) };
      }
      return { title: clean(item), detail: "" };
    })
    .filter((item) => item.title)
    .slice(0, 30);
  return items.length ? { kind: "list", title: clean(args.title) || "List", items } : null;
}

function chartPanel(args: Record<string, unknown>): Panel | null {
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
    points: points as ChartPoint[],
  };
}

function imagesPanel(args: Record<string, unknown>, result: string): Panel | null {
  try {
    const images: ImageItem[] = JSON.parse(result.split("\n", 1)[0]).images ?? [];
    const usable = images.filter((i) => typeof i.thumb === "string" && i.thumb.startsWith("https://"));
    return usable.length ? { kind: "images", title: clean(args.query) || "Pictures", images: usable } : null;
  } catch {
    return null;
  }
}

export function panelFor(call: ToolEntry | undefined): Panel | null {
  if (!call || call.kind === "permission" || call.result === null || call.result === undefined) return null;
  const result = String(call.result);
  if (REFUSED.test(result)) return null;
  const args = call.args ?? {};
  if (call.name === "show_list") return listPanel(args);
  if (call.name === "show_chart") return chartPanel(args);
  if (call.name === "show_images") return imagesPanel(args, result);
  return null;
}

export function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* What the voice screen puts in the middle for a reply: the last thing
   Shadow chose to show, or else the search it ran, as a list. */
export function stagePanel(message: Message | undefined): Panel | null {
  const tools = message?.tools ?? [];
  for (let i = tools.length - 1; i >= 0; i--) {
    const panel = panelFor(tools[i]);
    if (panel) return panel;
  }
  const search = [...tools].reverse().find((t) => t.kind !== "permission" && t.name === "web_search" && t.result);
  if (!search || search.kind === "permission") return null;
  const results = parseResults(String(search.result));
  if (!results) return null;
  return {
    kind: "list",
    title: `Results for “${clean(search.args?.query)}”`,
    items: results.map((r) => ({ title: r.title, detail: hostOf(r.url), href: r.url })),
  };
}
