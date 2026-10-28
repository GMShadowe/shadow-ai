const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function PaperclipIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function ChevronIcon(props) {
  return (
    <svg {...base} width={14} height={14} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowUpIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function SlidersIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function PencilIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CopyIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function StopIcon(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function SidebarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

/* Message actions */
export function RefreshIcon(props) {
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

export function ThumbUpIcon(props) {
  return <svg {...base} {...props}>{THUMB}</svg>;
}

export function ThumbDownIcon(props) {
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

export function GeneralIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7.5 10.5l2.5 2-2.5 2" />
      <path d="M13 14.5h4" />
    </svg>
  );
}

export function PersonalityIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-7 4V7z" />
      <path d="M9 9.5v3M15 9.5v3" />
    </svg>
  );
}

export function MemoryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h10M4 12h16M4 17h7" />
      <path d="M18.5 7h.01" />
    </svg>
  );
}

export function ToolsIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function PrivacyIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="10" width="16" height="10" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

export function AppearanceIcon(props) {
  return (
    <svg {...base} {...props}>
          <path d="M20 4L9 15" />
          <path d="M8.5 13.5a3.5 3.5 0 0 0-3.5 3.5c0 1-.5 2-1.5 2.5 1.5 1 4 .5 5-1a3.5 3.5 0 0 0 0-5z" />
        </svg>
  );
}

export function BrainIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="7.5" y="7.5" width="9" height="9" rx="2.5" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
    </svg>
  );
}

export function DataIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="6" rx="2.5" />
      <rect x="3.5" y="13.5" width="17" height="6" rx="2.5" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </svg>
  );
}

export function AboutIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5v4.5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function SkillsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h8l4.5 4.5v12H6z" />
      <path d="M9.5 13l2 2 4-4" />
    </svg>
  );
}

export function OutboundIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 14v4a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4 18V7.5A2.5 2.5 0 0 1 6.5 5H11" />
      <path d="M15 4h5v5" />
      <path d="M20 4l-8 8" />
    </svg>
  );
}

export function DownloadIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v10" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  );
}

/* Voice mode */
export function MicIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v2.5M8.5 20.5h7" />
    </svg>
  );
}

export function HistoryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

export function ListIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h7" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5h16" />
      <path d="M6.5 19.5v-6M11 19.5V8M15.5 19.5v-8.5M20 19.5V5.5" />
    </svg>
  );
}

export function ImageIcon(props) {
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
export function AssistantIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/* The switcher's up/down chevron pair, for a control that opens a list of
   things to swap between rather than a menu of actions. */
export function SwapIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 9l5-5 5 5" />
      <path d="M17 15l-5 5-5-5" />
    </svg>
  );
}
