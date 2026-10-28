/* Microphone capture for voice mode.

   Tap starts it; going quiet ends it. The user decides when it begins so
   it never listens to the room, and it works out when they finished so
   they aren't holding a key while they think.

   Deliberately NOT the Web Speech API: that ships audio to Google, which
   is the one thing Shadow promises never to do. This records raw samples,
   writes a WAV in the page, and posts it to the local brain.

   Raw samples rather than MediaRecorder, too — MediaRecorder gives webm
   or mp4 depending on the browser, and then something has to decode it.
   An AudioWorklet hands over plain Float32 and there is no codec in the
   story at all.

   The end of an utterance is decided here, not on the server: posting
   audio every 30ms so a server-side VAD could watch it would cost a
   round trip per frame. Silero still runs on the brain side as the second
   opinion on whether there was any speech at all. */

export const TARGET_RATE = 16000;
const SILENCE_MS = 800; // quiet for this long means the sentence is over
const START_TIMEOUT_MS = 6000; // tapped, then said nothing
const MAX_MS = 30000; // hard cap on one utterance
const MIN_SPEECH_MS = 200;
const FLOOR_CHUNKS = 6; // ~70ms of room tone, to learn what "quiet" is here
const FLOOR_MULTIPLE = 4;
const MIN_THRESHOLD = 0.012;
// Speech into a laptop microphone sits well above this, so the bar can never
// be raised out of reach — which is what happened when someone started
// talking the instant they tapped and their own voice became the "floor".
const MAX_THRESHOLD = 0.045;

export class RecorderError extends Error {
  constructor(message, { cancelled = false } = {}) {
    super(message);
    this.name = "RecorderError";
    this.cancelled = cancelled;
  }
}

function micError(e) {
  const name = e?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new RecorderError(
      "Shadow can't hear you: microphone access was blocked. Allow the microphone for this page in your browser, then tap again."
    );
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new RecorderError("No microphone found. Connect one, or pick an input in your system sound settings.");
  }
  if (name === "NotReadableError") {
    return new RecorderError("The microphone is busy in another app. Close that, then tap again.");
  }
  return new RecorderError(`Couldn't start the microphone: ${e?.message || name || "unknown error"}`);
}

/* An AudioWorklet that forwards every block of samples. Defined as a
   string so there is no extra asset to serve or keep in sync. */
const WORKLET_SOURCE = `
class ShadowCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) this.port.postMessage(new Float32Array(channel));
    return true;
  }
}
registerProcessor("shadow-capture", ShadowCapture);
`;

async function captureNode(ctx, onChunk) {
  // AudioWorklet runs off the main thread, so a busy UI can't drop samples.
  try {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const node = new AudioWorkletNode(ctx, "shadow-capture");
    node.port.onmessage = (e) => onChunk(e.data);
    return node;
  } catch {
    // Older WebKit: ScriptProcessor is deprecated but it is still here.
    const node = ctx.createScriptProcessor(1024, 1, 1);
    node.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
    return node;
  }
}

function rms(chunk) {
  let sum = 0;
  for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
  return Math.sqrt(sum / (chunk.length || 1));
}

function downsample(chunks, from, to) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const joined = new Float32Array(total);
  let at = 0;
  for (const c of chunks) {
    joined.set(c, at);
    at += c.length;
  }
  if (from === to) return joined;

  const ratio = from / to;
  const out = new Float32Array(Math.max(1, Math.floor(total / ratio)));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const low = Math.floor(pos);
    const high = Math.min(low + 1, total - 1);
    const frac = pos - low;
    out[i] = joined[low] * (1 - frac) + joined[high] * frac;
  }
  return out;
}

/* 16-bit mono WAV, which the brain reads with the standard library. */
export function encodeWav(samples, rate = TARGET_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/* Records one utterance and resolves with { wav, seconds }.
   `signal` aborting means "I'm done now": whatever was said is kept, and
   if nothing was said it resolves as cancelled instead of as an error. */
export async function recordUtterance({ signal, onLevel, onSpeechStart } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new RecorderError(
      "This browser can't record audio here. Open Shadow at localhost rather than a network address, or use a recent Chrome, Edge or Safari."
    );
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    throw micError(e);
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const chunks = [];
  let node;
  let source;
  let mute;

  try {
    const started = Date.now();
    let floor = Infinity;
    let floorCount = 0;
    let threshold = MIN_THRESHOLD;
    const bar = (f) => Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, f * FLOOR_MULTIPLE));
    let speechStart = 0;
    let lastLoud = 0;
    let loudRun = 0;

    const finished = new Promise((resolve, reject) => {
      const stop = (reason) => resolve(reason);

      const onAbort = () => {
        if (speechStart) stop("tapped");
        else reject(new RecorderError("Stopped before anything was said.", { cancelled: true }));
      };
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener("abort", onAbort, { once: true });
      }

      captureNode(ctx, (chunk) => {
        chunks.push(chunk);
        const level = rms(chunk);
        onLevel?.(level);
        const now = Date.now();

        // Learn the room: a loud fan and a quiet study need different ideas of
        // what silence sounds like. The quietest frame heard so far is the
        // floor, so one loud word early on can't poison the estimate.
        floor = Math.min(floor, level);
        threshold = bar(floor);
        if (floorCount < FLOOR_CHUNKS) {
          floorCount += 1;
          return;
        }

        if (level > threshold) {
          loudRun += 1;
          lastLoud = now;
          if (!speechStart && loudRun >= 2) {
            speechStart = now;
            onSpeechStart?.();
          }
        } else {
          loudRun = 0;
        }

        if (!speechStart) {
          if (now - started > START_TIMEOUT_MS) {
            reject(new RecorderError("I didn't hear anything. Tap the mic and speak when the bars move."));
          }
          return;
        }
        if (now - lastLoud > SILENCE_MS) stop("silence");
        else if (now - speechStart > MAX_MS) stop("too long");
      })
        .then((created) => {
          node = created;
          source = ctx.createMediaStreamSource(stream);
          // Through a silent gain node: the graph needs a destination to pull
          // samples, and without the zero gain the mic would come out of the
          // speakers.
          mute = ctx.createGain();
          mute.gain.value = 0;
          source.connect(node);
          node.connect(mute);
          mute.connect(ctx.destination);
        })
        .catch((e) => reject(new RecorderError(`Couldn't start recording: ${e.message}`)));
    });

    const reason = await finished;
    const samples = downsample(chunks, ctx.sampleRate, TARGET_RATE);
    const seconds = samples.length / TARGET_RATE;
    if (seconds * 1000 < MIN_SPEECH_MS) {
      throw new RecorderError("That was too short to hear. Tap, speak, then pause.");
    }
    return { wav: encodeWav(samples), seconds, reason };
  } finally {
    try {
      source?.disconnect();
      node?.disconnect();
      mute?.disconnect();
      if (node?.port) node.port.onmessage = null;
      else if (node) node.onaudioprocess = null;
      await ctx.close();
    } catch (e) {
      // Tearing down a closed context is noisy but harmless; still say so.
      console.warn("[voice] audio teardown:", e.message);
    }
    for (const track of stream.getTracks()) track.stop();
  }
}
