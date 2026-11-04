import { speak } from "@/lib/api";

/* Speaks a reply while it is still being written. Each finished sentence
   is sent to the brain's piper voice as soon as it exists, and the audio
   for the next one is fetched while the current one plays, so speech starts
   about one sentence after the text does. */

const SENTENCE_END = /[.!?…]+["')\]]*(?=\s)|\n+/g;
const LONGEST = 280;

/** The finished sentences at the start of `text`, and how many characters
    they used. With `final`, whatever is left counts as finished too. */
export function takeSentences(text: string, final: boolean): { ready: string[]; used: number } {
  const ready: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    const piece = text.slice(start, end).trim();
    if (piece) ready.push(piece);
    start = end;
  }
  let rest = text.slice(start);
  while (rest.length > LONGEST) {
    const window = rest.slice(0, LONGEST);
    const cut = Math.max(window.lastIndexOf(", ") + 1, window.lastIndexOf(" "));
    const at = cut > LONGEST / 2 ? cut : LONGEST;
    ready.push(rest.slice(0, at).trim());
    start += at;
    rest = rest.slice(at);
  }
  if (final && rest.trim()) {
    ready.push(rest.trim());
    start = text.length;
  }
  return { ready, used: start };
}

const WEB = new Set(["web_search", "fetch_url", "http_request", "show_images"]);
const FILES = new Set(["read_file", "list_dir", "find_files", "search_text"]);

/** What to say while a tool runs and nothing has been said yet, so the
    pause isn't silent. */
export function fillerFor(tool: string): string {
  if (WEB.has(tool)) return "Hang on, let me look that up.";
  if (FILES.has(tool)) return "Let me check.";
  if (tool === "run_command") return "One moment, running that.";
  return "One moment.";
}

export class Speaker {
  private queue: Promise<Blob>[] = [];
  private controller = new AbortController();
  private generation = 0;
  private running = false;
  private audio: HTMLAudioElement | null = null;
  private finishCurrent: (() => void) | null = null;

  private onSpeaking: (speaking: boolean) => void;
  private onError: (message: string) => void;

  constructor(onSpeaking: (speaking: boolean) => void, onError: (message: string) => void) {
    this.onSpeaking = onSpeaking;
    this.onError = onError;
  }

  say(text: string) {
    if (!text.trim()) return;
    const clip = speak(text, this.controller.signal);
    clip.catch(() => {});
    this.queue.push(clip);
    void this.pump();
  }

  stop() {
    this.generation += 1;
    this.controller.abort();
    this.controller = new AbortController();
    this.queue = [];
    this.audio?.pause();
    this.finishCurrent?.();
    if (this.running) {
      this.running = false;
      this.onSpeaking(false);
    }
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    this.onSpeaking(true);
    const generation = this.generation;
    while (this.queue.length && generation === this.generation) {
      const clip = this.queue.shift()!;
      let blob: Blob;
      try {
        blob = await clip;
      } catch (e) {
        if (generation !== this.generation) return;
        this.onError((e as Error).message);
        this.stop();
        return;
      }
      if (generation !== this.generation) return;
      await this.play(blob);
    }
    if (generation === this.generation) {
      this.running = false;
      this.onSpeaking(false);
    }
  }

  private play(blob: Blob): Promise<void> {
    const src = URL.createObjectURL(blob);
    const audio = new Audio(src);
    this.audio = audio;
    return new Promise((resolve) => {
      const finish = () => {
        URL.revokeObjectURL(src);
        if (this.audio === audio) this.audio = null;
        this.finishCurrent = null;
        resolve();
      };
      this.finishCurrent = finish;
      audio.onended = finish;
      audio.onerror = () => {
        console.warn("[voice] couldn't play a spoken sentence");
        finish();
      };
      audio.play().catch((e: Error) => {
        this.onError(`Couldn't play the reply out loud: ${e.message}`);
        finish();
      });
    });
  }
}
