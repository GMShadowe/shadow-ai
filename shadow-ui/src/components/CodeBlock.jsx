import { Children, isValidElement, useState } from "react";
import { CopyIcon, CheckIcon } from "./Icons.jsx";

function textOf(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

export default function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Children.toArray(children).find(isValidElement);
  const className = code?.props?.className || "";
  const language = (className.match(/language-([\w+#-]+)/) || [])[1];
  const text = textOf(code?.props?.children).replace(/\n$/, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked, nothing to do
    }
  }

  return (
    <div className="code-block overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] text-ink-muted">{language ?? "text"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
        >
          {copied ? <CheckIcon width={12} height={12} className="text-phosphor" /> : <CopyIcon width={12} height={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className={className}>{code?.props?.children}</code>
      </pre>
    </div>
  );
}
