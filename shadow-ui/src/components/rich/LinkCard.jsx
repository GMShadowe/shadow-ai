import { useState } from "react";
import { previewImage } from "../../api.js";
import { OutboundIcon } from "../Icons.jsx";
import { usePreview } from "./previews.js";

/* A link on its own line becomes a card. Three states, and the third one
   matters most: plenty of sites refuse to be read, so a failed fetch has to
   look like a deliberate plain link rather than a broken card. */

function Favicon({ icon, site }) {
  const [failed, setFailed] = useState(false);
  if (!icon || failed) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-panel-alt font-mono text-[9px] text-ink-muted">
        {(site || "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={previewImage(icon)}
      alt=""
      width={16}
      height={16}
      onError={() => setFailed(true)}
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
    />
  );
}

export function PlainLink({ href, children, note }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={note || undefined}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-panel/60 px-2 py-1 align-middle text-sm text-ink no-underline transition-colors duration-150 hover:border-signal/50 hover:bg-panel-alt"
    >
      <OutboundIcon width={12} height={12} className="shrink-0 text-ink-muted" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function Price({ product }) {
  if (!product?.price) {
    // Prices are usually drawn by JavaScript and aren't in the HTML at all.
    // Saying so beats showing a number Shadow made up.
    return <span className="text-[11px] text-ink-muted">Price isn't in the page's data</span>;
  }
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥" }[product.currency];
  const amount = Number(product.price);
  const shown = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : product.price;
  return (
    <span className="text-sm font-medium text-ink">
      {symbol ?? ""}
      {shown}
      {!symbol && product.currency ? ` ${product.currency}` : ""}
    </span>
  );
}

/* `attached` means the link is already in the sentence above, so this is an
   extra: it shows nothing at all until there is a real card to show. On its
   own line a link is the whole block, so there it shows a loading state and
   falls back to a plain link. */
export default function LinkCard({ href, label, attached = false }) {
  const card = usePreview(href);
  const [imageFailed, setImageFailed] = useState(false);

  if (attached && (!card || !card.ok)) return null;

  if (!card) {
    return (
      <span className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-panel/60 px-3 py-2">
        <span className="spinner shrink-0" aria-hidden="true" />
        <span className="truncate font-mono text-[11px] text-ink-muted">{label || href}</span>
      </span>
    );
  }

  if (!card.ok) {
    return (
      <PlainLink href={href} note={`No preview: ${card.reason}`}>
        {label || href}
      </PlainLink>
    );
  }

  const product = card.kind === "product" ? card.product : null;
  const image = card.image && !imageFailed ? previewImage(card.image) : null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="animate-rise flex max-w-xl overflow-hidden rounded-lg border border-line bg-panel/60 no-underline transition-colors duration-150 hover:border-signal/50 hover:bg-panel-alt"
    >
      {image && (
        <span className="hidden w-28 shrink-0 bg-panel-alt sm:block">
          <img
            src={image}
            alt=""
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
            style={{ aspectRatio: product ? "1 / 1" : "4 / 3" }}
          />
        </span>
      )}
      <span className="min-w-0 flex-1 px-3 py-2.5">
        <span className="flex items-center gap-1.5">
          <Favicon icon={card.icon} site={card.site} />
          <span className="truncate font-mono text-[11px] text-ink-muted">{card.site}</span>
          {product && (
            <span className="ml-auto shrink-0 rounded border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wider text-ink-muted">
              product
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-ink">
          {product?.name || card.title}
        </span>
        {card.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-muted">
            {card.description}
          </span>
        )}
        {product && (
          <span className="mt-1.5 flex items-baseline gap-2">
            <Price product={product} />
            {product.availability && (
              <span className="text-[11px] text-ink-muted">{product.availability}</span>
            )}
          </span>
        )}
      </span>
    </a>
  );
}
