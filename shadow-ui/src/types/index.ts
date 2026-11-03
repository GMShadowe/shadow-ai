/* Shapes shared across the app. These describe what the brain sends back,
   so they are deliberately loose where the brain is (extra fields pass
   through untouched). */

export type Role = "user" | "assistant" | "error";
export type Rating = "up" | "down" | null;
export type Decision = "allow" | "deny" | "always" | "timeout";

export interface RouterDecision {
  method?: string;
  ms?: number;
  probabilities?: Record<string, number>;
  [key: string]: unknown;
}

export interface ToolRun {
  kind?: undefined;
  name: string;
  args?: Record<string, unknown>;
  result: string | null;
  /** Client-side timing, for the duration shown on a live turn (ms since epoch). */
  startedAt?: number;
  endedAt?: number;
}

export interface PermissionRequest {
  kind: "permission";
  id: string;
  name: string;
  args?: Record<string, unknown>;
  preview?: string | null;
  decision: Decision | null;
}

export type ToolEntry = ToolRun | PermissionRequest;

export interface Failure {
  kind?: string;
  action?: "pull" | "retry" | "models" | "privacy" | string;
  model?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  images?: string[];
  tools?: ToolEntry[];
  route?: string | null;
  router?: RouterDecision | null;
  model?: string;
  effort?: string;
  skill?: string | null;
  stopped?: boolean;
  streaming?: boolean;
  /** When this reply started streaming, client-side; drives the elapsed timer. */
  startedAt?: number;
  error?: Failure | null;
  rating?: Rating;
  rating_reason?: string | null;
  rating_reason_code?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  /** null until a saved chat is opened and its messages are fetched */
  messages: Message[] | null;
  saved: boolean;
  updatedAt: string | null;
  voice?: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
  model?: string;
  description?: string;
  reason?: string;
  available: boolean;
  vision?: boolean;
  sends_data?: boolean;
  host?: string;
}

export interface FeedbackReason {
  code: string;
  label: string;
}

export interface Status {
  models: ModelInfo[];
  default_model: string;
  efforts: string[];
  default_effort: string;
  router: string;
  workspace: string;
  assistant: { id: string; name: string };
  onboarded: boolean;
  usage: { today: number } | null;
  adapters: string[];
  tools: unknown;
  feedback_reasons: FeedbackReason[];
}

export interface Spend {
  turn: number | null;
  today: number;
  host: string | null;
}

export interface Skill {
  name: string;
  description?: string;
  broken?: boolean;
  [key: string]: unknown;
}

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  base64: string;
}

export interface SearchHit {
  id: string;
  title: string;
  hits: number;
  snippet?: string;
  role?: Role;
}

/** Every event a turn can stream back over SSE. */
export type StreamEvent =
  | { type: "route"; route: string; router: RouterDecision; model?: string; effort?: string; skill?: string | null }
  | { type: "permission"; id: string; name: string; args?: Record<string, unknown>; preview?: string | null }
  | { type: "permission_result"; id: string; decision: Decision }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_end"; name: string; result: string }
  | { type: "token"; text: string }
  | { type: "done"; reply: string }
  | { type: "usage"; turn: number; today: number; host: string }
  | { type: "error"; message: string; kind?: string; action?: string; model?: string };

/** The pull endpoint streams its own, looser progress events. */
export type ProgressEvent = { type?: string; [key: string]: unknown };

export type ExportFormat = "md" | "json";
