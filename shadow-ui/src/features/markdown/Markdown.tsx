import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";
import DataTable from "./DataTable";
import FileChip from "./FileChip";
import { repairTables } from "./fixTables";
import LinkCard from "./LinkCard";

/* Richer elements, inferred from the text and from what the tools did.

   Nothing here depends on the model emitting special syntax: small models
   would get it wrong, and a reply has to stay readable as plain markdown.

   - a paragraph whose entire content is one link becomes a card
   - a link inside a sentence stays inline, with a card underneath once it resolves
   - a path a tool in this turn actually read or wrote becomes a file chip
   - a table gets a sticky header and a CSV button */

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { href?: unknown };
  children?: HastNode[];
}

interface Link {
  href: string;
  label: string;
}

const textOf = (n: HastNode) => (n.children ?? []).map((c) => c.value ?? "").join("");

/* Every link in a block, in order, deduplicated. */
function linksIn(node: HastNode | undefined, found: Link[] = [], seen = new Set<string>()): Link[] {
  for (const child of node?.children ?? []) {
    if (child.type === "element" && child.tagName === "a") {
      const href = child.properties?.href;
      if (typeof href === "string" && /^https?:\/\//.test(href) && !seen.has(href)) {
        seen.add(href);
        found.push({ href, label: textOf(child) });
      }
    } else if (child.children) {
      linksIn(child, found, seen);
    }
  }
  return found;
}

// A paragraph quoting four links shouldn't turn into four cards.
const MAX_ATTACHED = 3;

function AttachedCards({ node }: { node?: HastNode }) {
  const links = linksIn(node).slice(0, MAX_ATTACHED);
  if (links.length === 0) return null;
  return (
    <span className="mt-2 flex flex-col gap-1.5">
      {links.map((link) => (
        <LinkCard key={link.href} href={link.href} label={link.label} attached />
      ))}
    </span>
  );
}

/* Whether a block is nothing but one link, read off the markdown tree. */
function soleLink(node?: HastNode): Link | null {
  const children = (node?.children ?? []).filter((c) => c.type !== "text" || (c.value ?? "").trim() !== "");
  if (children.length !== 1) return null;
  const only = children[0];
  if (only.type !== "element" || only.tagName !== "a") return null;
  const href = only.properties?.href;
  if (typeof href !== "string" || !/^https?:\/\//.test(href)) return null;
  return { href, label: textOf(only) };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Split a text node on any workspace path the tools touched. */
function withChips(text: string, files: Map<string, string>): ReactNode {
  if (!files.size) return text;
  const names = [...files.keys()].sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`(${names.map(escapeRe).join("|")})`, "g"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    files.has(part) ? <FileChip key={i} path={files.get(part)!} name={part.split("/").pop() ?? part} /> : part,
  );
}

function mapText(children: ReactNode, files: Map<string, string>) {
  return Children.map(children, (child) => (typeof child === "string" ? withChips(child, files) : child));
}

interface MarkdownProps {
  text: string;
  /** The paths the turn's tools touched. Without it a path stays text. */
  files?: Map<string, string>;
}

export default function Markdown({ text, files = new Map() }: MarkdownProps) {
  const components: Components = {
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    table: ({ children }) => <DataTable>{children}</DataTable>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
    p: ({ node, children }) => {
      const link = soleLink(node as HastNode);
      if (link) return <LinkCard href={link.href} label={link.label} />;
      return (
        <>
          <p>{mapText(children, files)}</p>
          <AttachedCards node={node as HastNode} />
        </>
      );
    },
    li: ({ node, children }) => {
      const link = soleLink(node as HastNode);
      if (link) {
        return (
          <li>
            <LinkCard href={link.href} label={link.label} />
          </li>
        );
      }
      return (
        <li>
          {mapText(children, files)}
          <AttachedCards node={node as HastNode} />
        </li>
      );
    },
    code: ({ children, node: _node, ...rest }) => {
      // Inline code is where a model usually puts a path.
      const label = Children.toArray(children).join("");
      const path = files.get(label);
      if (path) return <FileChip path={path} name={label.split("/").pop() ?? label} />;
      return <code {...rest}>{mapText(children, files)}</code>;
    },
  };

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true }]]} components={components}>
        {repairTables(text)}
      </ReactMarkdown>
    </div>
  );
}
