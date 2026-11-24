import type { ModelInfo } from "@/types";

export interface Hardware {
  os?: string;
  machine?: string;
  cpu_cores?: number;
  ram_total_gb?: number;
  disk_free_gb?: number;
  gpu?: { name: string; vram_gb: number; vendor: string } | null;
}

/* A built-in tier as setup shows it. Everything here comes from the brain's
   model list, which already knows what fits this computer. */
export interface Tier {
  id: string;
  label: string;
  base: string;
  bytes: number;
  approx: boolean;
  needs: string;
  blurb: string;
  fits: boolean;
  strong: boolean;
}

export type PartId = "screen" | "cpu" | "memory" | "disk" | "model";

export interface Callout {
  id: PartId;
  label: string;
  detail: string;
}

export const EMBEDDER = { label: "Memory", base: "nomic-embed-text", bytes: 274_302_450, approx: false };

export function toTier(m: ModelInfo): Tier {
  return {
    id: m.id,
    label: m.label,
    base: m.model ?? m.id,
    bytes: (m.download_gb ?? 0) * 1e9,
    approx: !!m.download_approx,
    needs: m.needs ?? "",
    blurb: m.description ?? "",
    fits: m.fits ?? m.available,
    strong: !!m.strong,
  };
}

/* The built-in tiers, in the brain's order; a strong tier is only in the list
   on a computer that can run it. */
export function builtInTiers(models: ModelInfo[]): Tier[] {
  return models.filter((m) => !m.custom).map(toTier);
}

/* The brain counts RAM in decimal gigabytes, so a 16 GB Mac reports 17.2.
   People know their machine by the number on the box. */
export function memoryOnTheBox(decimalGb: number): number {
  return Math.round((decimalGb * 1e9) / 2 ** 30);
}

export function formatBytes(bytes: number, approx = false): string {
  const gb = bytes / 1e9;
  const text = gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB` : `${Math.round(bytes / 1e6)} MB`;
  return approx ? `about ${text}` : text;
}

export function callouts(hw: Hardware, pick: Tier, recommended: string, considering: Tier | null = null): Callout[] {
  const out: Callout[] = [];
  if (hw.os) out.push({ id: "screen", label: hw.os, detail: "the system" });
  if (hw.cpu_cores) {
    const appleSilicon = (hw.os ?? "").startsWith("macOS") && hw.machine === "arm64";
    const chip = hw.gpu ? `${hw.gpu.name} ${hw.gpu.vram_gb} GB` : appleSilicon ? "Apple silicon" : hw.machine;
    out.push({
      id: "cpu",
      label: `${hw.cpu_cores} cores${chip ? ` · ${chip}` : ""}`,
      detail: hw.gpu ? "the card does the thinking" : "does the thinking",
    });
  }
  if (hw.ram_total_gb) {
    const detail = considering
      ? `${considering.label} needs ${considering.needs.replace(/^an? /, "")}${considering.fits ? " · fits" : " · too little"}`
      : "holds the model";
    out.push({ id: "memory", label: `${memoryOnTheBox(hw.ram_total_gb)} GB memory`, detail });
  }
  if (hw.disk_free_gb) {
    out.push({
      id: "disk",
      label: `${Math.round(hw.disk_free_gb)} GB free`,
      detail: considering ? `${formatBytes(considering.bytes, considering.approx)} to download` : "model and chats live here",
    });
  }
  out.push({ id: "model", label: pick.base, detail: pick.id === recommended ? "runs well here" : "your pick" });
  return out;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
