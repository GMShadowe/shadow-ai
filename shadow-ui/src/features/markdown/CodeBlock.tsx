import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { CheckIcon, CodeIcon, CopyIcon, WrapIcon } from "@/components/icons";
import Tooltip from "@/components/ui/Tooltip";

type CodeProps = { className?: string; children?: ReactNode };

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/* A code block in a reply: a rounded card a step lighter than the canvas,
   with a hairline, the language on the left of its header and two icon
   tools on the right.
   The header sticks under the top bar while a long block scrolls past, so
   Copy is always one click away. */
export default function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const code = Children.toArray(children).find(isValidElement) as ReactElement<CodeProps> | undefined;
  const className = code?.props.className || "";
  const language = (className.match(/language-([\w+#-]+)/) || [])[1];
  const text = textOf(code?.props.children).replace(/\n$/, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, nothing to do
    }
  }

  const tool =
    "grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-[background-color,color,scale] duration-100 hover:bg-ink/[0.07] hover:text-ink active:scale-[0.96]";
  const name = language ? language.charAt(0).toUpperCase() + language.slice(1) : "Text";

  return (
    <div className="code-block overflow-clip rounded-2xl border border-line bg-panel">
      <div className="sticky top-0 z-[1] flex items-center gap-2 bg-panel py-1.5 pl-3.5 pr-1.5">
        <CodeIcon width={14} height={14} className="text-ink-muted" />
        <span className="text-[12.5px] font-medium text-ink">{name}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <Tooltip label={wrap ? "Don't wrap lines" : "Wrap long lines"} side="top">
            {(describe) => (
              <button type="button" onClick={() => setWrap((w) => !w)} aria-pressed={wrap} aria-label="Wrap long lines" {...describe} className={`${tool} ${wrap ? "!text-ink bg-ink/[0.07]" : ""}`}>
                <WrapIcon width={15} height={15} />
              </button>
            )}
          </Tooltip>
          <Tooltip label={copied ? "Copied" : "Copy code"} side="top">
            {(describe) => (
              <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy code"} {...describe} className={tool}>
                <span className="relative grid h-[15px] w-[15px] place-items-center">
                  <CopyIcon width={15} height={15} className="swap-icon absolute" data-on={!copied} />
                  <CheckIcon width={15} height={15} className="swap-icon absolute" data-on={copied} />
                </span>
              </button>
            )}
          </Tooltip>
        </span>
      </div>
      <pre className={`overflow-x-auto px-4 pb-3.5 pt-1 ${wrap ? "whitespace-pre-wrap break-words" : ""}`}>
        <code className={className}>{code?.props.children}</code>
      </pre>
    </div>
  );
}
