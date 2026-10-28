/* Stand-in data for the voice screen, so the layout can be judged before
   the audio pipeline exists.

   The shapes here are the contract: later these come from tool results,
   built by code, not chosen by the model. web_search gives titles and
   urls (a list), list_dir gives file names (a list), a numeric answer
   gives points (a chart), and anything visual gives an image.

   Delete this file once real data arrives. */

// A small local picture, so nothing on this screen reaches the network.
const SWATCH = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="#20242b"/>
  <circle cx="250" cy="170" r="90" fill="#5e8f6b" opacity="0.65"/>
  <circle cx="370" cy="240" r="110" fill="#6fa3c7" opacity="0.5"/>
  <rect x="60" y="320" width="520" height="8" rx="4" fill="#2b2f37"/>
</svg>`)}`;

export const PANELS = {
  list: {
    kind: "list",
    title: "Top results for “local-first apps”",
    source: "web_search",
    items: [
      { title: "Local-first software: you own your data", subtitle: "inkandswitch.com/local-first" },
      { title: "CRDTs: the hard parts", subtitle: "martin.kleppmann.com/2020/07/06" },
      { title: "SQLite as an application file format", subtitle: "sqlite.org/appfileformat.html" },
      { title: "Offline-first design patterns", subtitle: "web.dev/offline-cookbook" },
    ],
  },
  chart: {
    kind: "chart",
    title: "Tokens per second, by model size",
    source: "run_command",
    unit: "tok/s",
    points: [
      { label: "2b", value: 61 },
      { label: "4b", value: 38 },
      { label: "9b", value: 17 },
      { label: "14b", value: 9 },
    ],
  },
  image: {
    kind: "image",
    title: "shadow-workspace/play.html",
    source: "read_file",
    src: SWATCH,
    caption: "The page you asked me to open",
  },
};

export const PANEL_ORDER = ["list", "chart", "image"];

/* The live transcript of the exchange happening right now. Each state
   shows a different stage of the same exchange. */
export const EXCHANGE = {
  idle: { user: "", assistant: "" },
  listening: { user: "how fast is the 4b model on this machine", partial: true, assistant: "" },
  thinking: { user: "How fast is the 4b model on this machine?", assistant: "" },
  speaking: {
    user: "How fast is the 4b model on this machine?",
    assistant: "About 38 tokens a second. The 2b is roughly 60, and the 9b drops to 17 — I've put the numbers on screen.",
  },
};
