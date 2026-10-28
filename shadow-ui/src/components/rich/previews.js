import { createContext, useContext, useEffect } from "react";

/* The context and the hook live apart from the provider component so each
   file exports one kind of thing (and fast refresh keeps working). */
export const PreviewContext = createContext(null);

export function usePreview(url) {
  const ctx = useContext(PreviewContext);
  useEffect(() => {
    ctx?.request(url);
  }, [ctx, url]);
  // undefined while the fetch is in flight, so a card can show its loading state
  return ctx?.cards[url];
}
