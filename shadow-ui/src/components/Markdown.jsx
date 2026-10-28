import { Children } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CodeBlock from "./CodeBlock.jsx";
import DataTable from "./rich/DataTable.jsx";
import LinkCard, { PlainLink } from "./rich/LinkCard.jsx";
import FileChip from "./rich/FileChip.jsx";
import { repairTables } from "./rich/fixTables.js";

/* Richer elements, inferred from the text and from what the tools did.

   Nothing here depends on the model emitting special syntax: small models
   would get it wrong, and a reply has to stay readable as plain markdown.
   So the rules are structural:

   - a paragraph whose entire content is one link becomes a card
   - a link inside a sentence stays inline, just styled
   - a path a tool in this turn actually read or wrote becomes a file chip
   - a table gets a sticky header and a CSV button

   `files` is the set of paths the turn's tools touched. Without it a path
   is left as text, because a chip that can't open anything is a lie. */

/* Every link in a block, in order, deduplicated. */
function linksIn(node, found = [], seen = new Set()) {
  for (const child of node?.children ?? []) {
    if (child.type === "element" && child.tagName === "a") {
      const href = child.properties?.href;
      if (typeof href === "string" && /^https?:\/\//.test(href) && !seen.has(href)) {
        seen.add(href);
        found.push({ href, label: (child.children ?? []).map((c) => c.value ?? "").join("") });
      }
    } else if (child.children) {
      linksIn(child, found, seen);
    }
  }
  return found;
}

// A paragraph quoting four links shouldn't turn into four cards.
const MAX_ATTACHED = 3;

/* Cards for links that are part of a sentence. The prose still reads as
   prose with the link inline; the card goes underneath it, and only once
   the preview has actually resolved - a link that can't be fetched leaves
   nothing behind but the inline link it already had. */
function AttachedCards({ node }) {
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

/* Whether a block is nothing but one link, read off the markdown tree
   rather than the rendered output - the rendered children are the props
   react-markdown passed in, not the elements this file returned. */
function soleLink(node) {
  const children = (node?.children ?? []).filter(
    (child) => child.type !== "text" || child.value.trim() !== ""
  );
  if (children.length !== 1) return null;
  const only = children[0];
  if (only.type !== "element" || only.tagName !== "a") return null;
  const href = only.properties?.href;
  if (typeof href !== "string" || !/^https?:\/\//.test(href)) return null;
  const label = (only.children ?? []).map((c) => c.value ?? "").join("");
  return { href, label };
}

/* Split a text node on any workspace path the tools touched. */
function withChips(text, files) {
  if (!files?.size) return text;
  const names = [...files.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${names.map(escapeRe).join("|")})`, "g");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    files.has(part)
      ? <FileChip key={i} path={files.get(part)} name={part.split("/").pop()} />
      : part
  );
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapText(children, files) {
  return Children.map(children, (child) =>
    typeof child === "string" ? withChips(child, files) : child
  );
}

export default function Markdown({ text, files }) {
  const components = {
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    table: ({ children }) => <DataTable>{children}</DataTable>,

    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),

    // A paragraph that is nothing but a link is a card; everything else is
    // a normal paragraph with chips substituted into its text.
    p: ({ node, children }) => {
      const link = soleLink(node);
      if (link) return <LinkCard href={link.href} label={link.label} />;
      return (
        <>
          <p>{mapText(children, files)}</p>
          <AttachedCards node={node} />
        </>
      );
    },

    li: ({ node, children }) => {
      const link = soleLink(node);
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
          <AttachedCards node={node} />
        </li>
      );
    },

    code: ({ children, ...rest }) => {
      // Inline code is where a model usually puts a path.
      const label = Children.toArray(children).join("");
      if (files?.has(label)) {
        return <FileChip path={files.get(label)} name={label.split("/").pop()} />;
      }
      return <code {...rest}>{mapText(children, files)}</code>;
    },
  };

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true }]]}
        components={components}
      >
        {repairTables(text)}
      </ReactMarkdown>
    </div>
  );
}

export { PlainLink };
