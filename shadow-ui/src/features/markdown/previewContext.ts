import { createContext, useContext, useEffect } from "react";

export interface PreviewCard {
  ok: boolean;
  url: string;
  reason?: string;
  kind?: string;
  site?: string;
  icon?: string;
  title?: string;
  description?: string;
  image?: string;
  product?: { name?: string; price?: string | number; currency?: string; availability?: string };
}

interface PreviewContextValue {
  cards: Record<string, PreviewCard>;
  request: (url: string) => void;
}

/* The context and the hook live apart from the provider component so each
   file exports one kind of thing (and fast refresh keeps working). */
export const PreviewContext = createContext<PreviewContextValue | null>(null);

export function usePreview(url: string): PreviewCard | undefined {
  const ctx = useContext(PreviewContext);
  useEffect(() => {
    ctx?.request(url);
  }, [ctx, url]);
  // undefined while the fetch is in flight, so a card can show its loading state
  return ctx?.cards[url];
}
