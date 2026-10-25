export type IconName =
  | "desk"
  | "learn"
  | "settings"
  | "file"
  | "audio"
  | "upload"
  | "check"
  | "play"
  | "reset"
  | "arrow"
  | "book"
  | "search"
  | "road"
  | "layers"
  | "moon"
  | "alert"
  | "trash"
  | "edit"
  | "download"
  | "plus";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    desk: (
      <>
        <path d="M3 9h18M5 9v11m14-11v11M8 5h8v4" />
      </>
    ),
    learn: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5a3.5 3.5 0 0 1 3.5 3V5.5Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.8 2.8-.06-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.08A1.8 1.8 0 0 0 8.7 19.3a1.8 1.8 0 0 0-2 .36l-.06.05-2.8-2.8.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.6 13.8H2v-4h.08A1.8 1.8 0 0 0 3.7 8.7a1.8 1.8 0 0 0-.36-2l-.05-.06 2.8-2.8.06.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.2 2.6V2h4v.08a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.06-.05 2.8 2.8-.05.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H22v4h-.08A1.8 1.8 0 0 0 19.4 15Z" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h4M9 13h6m-6 4h4" />
      </>
    ),
    audio: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m0 0L7 8m5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 6 9 6-9 6z" />,
    reset: (
      <>
        <path d="M4 4v6h6" />
        <path d="M5.6 15a7 7 0 1 0 .5-7.5L4 10" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    book: (
      <>
        <path d="M4 4h7v16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm16 0h-7v16h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    road: (
      <>
        <path d="M7 22 10 2m7 20L14 2M9 15h6M10 8h4" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    moon: <path d="M20 16.5A8.5 8.5 0 0 1 7.5 4 8.5 8.5 0 1 0 20 16.5Z" />,
    alert: (
      <>
        <path d="M12 3 2 21h20z" />
        <path d="M12 9v5m0 3v.1" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2m-1 0v14H9V6" />
        <path d="M10 11v6m4-6v6" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
  };

  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
