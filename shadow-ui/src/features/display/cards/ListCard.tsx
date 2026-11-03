import { ListIcon } from "@/components/icons";
import type { Panel } from "../panels";
import Frame from "./Frame";

/* A list Shadow was asked for, or search results. Numbered, a title and a
   line of detail per row; the rows arrive one after another. */
export default function ListCard({ panel }: { panel: Extract<Panel, { kind: "list" }> }) {
  const copyText = [panel.title, ...panel.items.map((it, i) => `${i + 1}. ${it.title}${it.detail ? ` - ${it.detail}` : ""}`)].join(
    "\n",
  );

  return (
    <Frame icon={ListIcon} title={panel.title} meta={`${panel.items.length} items`} copyText={copyText}>
      <ol className="divide-y divide-line">
        {panel.items.map((item, i) => (
          <li
            key={`${item.title}-${i}`}
            className="animate-rise grid grid-cols-[1.75rem_1fr] gap-x-2 px-5 py-3"
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
          >
            <span className="pt-px font-mono text-[11px] tabular-nums text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[14.5px] font-medium leading-snug text-ink underline-offset-2 hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <div className="text-[14.5px] font-medium leading-snug text-ink">{item.title}</div>
              )}
              {item.detail && <p className="mt-0.5 text-[13.5px] leading-normal text-ink-muted">{item.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Frame>
  );
}
