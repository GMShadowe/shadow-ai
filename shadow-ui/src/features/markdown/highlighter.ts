import { useEffect, useState } from "react";
import type { Options } from "react-markdown";

type Plugins = NonNullable<Options["rehypePlugins"]>;

const NONE: Plugins = [];
let loaded: Plugins | null = null;
let loading: Promise<Plugins> | null = null;

function load(): Promise<Plugins> {
  loading ??= import("rehype-highlight").then(({ default: rehypeHighlight }) => {
    loaded = [[rehypeHighlight, { detect: true }]];
    return loaded;
  });
  return loading;
}

export function hasCodeBlock(text: string): boolean {
  return text.includes("```") || text.includes("~~~");
}

export function useHighlighter(wanted: boolean): Plugins {
  const [plugins, setPlugins] = useState<Plugins | null>(loaded);

  useEffect(() => {
    if (!wanted || plugins) return;
    let live = true;
    load()
      .then((p) => live && setPlugins(p))
      .catch((error) => {
        loading = null;
        console.error("Couldn't load code highlighting; code blocks stay plain.", error);
      });
    return () => {
      live = false;
    };
  }, [wanted, plugins]);

  return wanted && plugins ? plugins : NONE;
}
