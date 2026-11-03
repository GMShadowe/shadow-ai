import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/* 1.75 rather than 2: the icons sit beside 13-14px text at weight 400-500,
   and a 2px stroke read heavier than the words next to it. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PaperclipIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...base} width={14} height={14} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function SidebarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

/* Message actions */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4.5v4h-4" />
    </svg>
  );
}

/* A thumb, drawn once. Dislike is the same shape flipped, so the pair can
   never drift apart. */
const THUMB = (
  <>
    <path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10z" />
    <path d="M7 10l4.2-6.4a1.8 1.8 0 0 1 3.3 1V8.5h3.6a2 2 0 0 1 1.95 2.45l-1.3 6A2 2 0 0 1 16.6 20H7" />
  </>
);

export function ThumbUpIcon(props: IconProps) {
  return <svg {...base} {...props}>{THUMB}</svg>;
}

export function ThumbDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <g transform="translate(0,24) scale(1,-1)">{THUMB}</g>
    </svg>
  );
}

/* Settings icons.

   One family with the rest of the app: the same 24x24 box, the same 2px
   stroke, round caps, no fills. Each one is two or three strokes, because
   anything finer turns to mush at 15px — so where a dot is needed it is a
   zero-length stroke ("h.01") rather than a filled circle, which keeps the
   weight identical to every other icon here. */

export function GeneralIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7.5 10.5l2.5 2-2.5 2" />
      <path d="M13 14.5h4" />
    </svg>
  );
}

export function PersonalityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-7 4V7z" />
      <path d="M9 9.5v3M15 9.5v3" />
    </svg>
  );
}

export function MemoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h10M4 12h16M4 17h7" />
      <path d="M18.5 7h.01" />
    </svg>
  );
}

export function ToolsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function PrivacyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="10" width="16" height="10" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

export function AppearanceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
          <path d="M20 4L9 15" />
          <path d="M8.5 13.5a3.5 3.5 0 0 0-3.5 3.5c0 1-.5 2-1.5 2.5 1.5 1 4 .5 5-1a3.5 3.5 0 0 0 0-5z" />
        </svg>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7.5" y="7.5" width="9" height="9" rx="2.5" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
    </svg>
  );
}

export function DataIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="6" rx="2.5" />
      <rect x="3.5" y="13.5" width="17" height="6" rx="2.5" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </svg>
  );
}

export function AboutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5v4.5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function SkillsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h8l4.5 4.5v12H6z" />
      <path d="M9.5 13l2 2 4-4" />
    </svg>
  );
}

export function OutboundIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 14v4a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4 18V7.5A2.5 2.5 0 0 1 6.5 5H11" />
      <path d="M15 4h5v5" />
      <path d="M20 4l-8 8" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v10" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  );
}

/* Voice mode */
export function MicIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v2.5M8.5 20.5h7" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h7" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5h16" />
      <path d="M6.5 19.5v-6M11 19.5V8M15.5 19.5v-8.5M20 19.5V5.5" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5l4.6-4.3a2 2 0 0 1 2.7 0l4.4 4.1M14.5 14.3l1.6-1.5a2 2 0 0 1 2.7 0l1.7 1.6" />
    </svg>
  );
}

/* An assistant. A head and shoulders, two strokes, because at 15px a
   detailed figure turns to mud. */
export function AssistantIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/* The switcher's up/down chevron pair, for a control that opens a list of
   things to swap between rather than a menu of actions. */
export function SwapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 9l5-5 5 5" />
      <path d="M17 15l-5 5-5-5" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m7.5 10.5 2.5 2-2.5 2" />
      <path d="M13 14.5h4" />
    </svg>
  );
}

/* New chat: a page with a pen across its corner. */
export function ComposeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13" />
      <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L13 13.9l-3.5.8.8-3.5z" />
    </svg>
  );
}

/* Web access: on when the brain may reach the internet. */
export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z" />
    </svg>
  );
}

/* Offline: the globe with a stroke through it. */
export function GlobeOffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.4 4.3A8.5 8.5 0 0 1 19.7 15.6M17.9 18.1A8.5 8.5 0 0 1 5.9 6.1" />
      <path d="M3.5 3.5l17 17" />
    </svg>
  );
}

/* The run picker's mark: a four-point spark. */
export function SparkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5c.6 4.4 2.6 6.9 7 8.5-4.4 1.6-6.4 4.1-7 8.5-.6-4.4-2.6-6.9-7-8.5 4.4-1.6 6.4-4.1 7-8.5z" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </svg>
  );
}

/* Shadow's mark: a form and the shadow it casts, two strokes. */
export function LogoMark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M17.6 8.6a5.5 5.5 0 0 1-9 9" opacity="0.55" />
    </svg>
  );
}

/* Routes, so a reply says at a glance which kind of help it was. */
export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.5A7.5 7.5 0 1 1 20 12z" />
    </svg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function WrapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16M4 12h12.5a3 3 0 0 1 0 6H13" />
      <path d="m15 16-2 2 2 2M4 17.5h5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3} />
    </svg>
  );
}

/* The voice-mode button: a short waveform. */
export function WaveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
      <path d="M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13.5 3.5V9H19" />
    </svg>
  );
}

/* The conversation's files and links: a list beside a stack. */
export function SourcesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth={2.5} />
      <path d="M9 6.5h10.5M9 12h10.5M9 17.5h6" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.5 7.5 0 0 0 2.6-1.5l2.3 1 2-3.4z" />
    </svg>
  );
}

/* The brand's four-point sparkle, filled. */
export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.01c-4.6.6-6.9 2.9-7.5 7.5h-.01c-.6-4.6-2.9-6.9-7.5-7.5V10c4.6-.6 6.9-2.9 7.5-7.5z" transform="translate(0 2)" />
    </svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </svg>
  );
}

/* Deep search: a magnifier with a spark in it. */
export function DeepSearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}
