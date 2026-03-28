import type { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  description?: string;
  tone?: "empty" | "error" | "loading";
  action?: ReactNode;
};

type StateTone = NonNullable<StatePanelProps["tone"]>;

const PANEL_TONE_STYLES: Record<
  StateTone,
  {
    panelClassName: string;
    titleClassName: string;
    descriptionClassName: string;
    role: "status" | "alert";
    ariaLive: "polite" | "assertive";
  }
> = {
  empty: {
    panelClassName:
      "border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(30,30,38,0.98)_0%,rgba(24,24,31,0.98)_100%)]",
    titleClassName: "text-[var(--app-text)]",
    descriptionClassName: "text-[var(--app-text-muted)]",
    role: "status",
    ariaLive: "polite"
  },
  loading: {
    panelClassName:
      "border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(30,30,38,0.98)_0%,rgba(24,24,31,0.98)_100%)]",
    titleClassName: "text-[var(--app-text)]",
    descriptionClassName: "text-[var(--app-text-muted)]",
    role: "status",
    ariaLive: "polite"
  },
  error: {
    panelClassName: "border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.14)] text-red-100",
    titleClassName: "",
    descriptionClassName: "text-red-100/80",
    role: "alert",
    ariaLive: "assertive"
  }
};

function EmptyStateIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] text-[var(--app-text-secondary)]">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 3v18M3 12h18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function LoadingStateIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.12)]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.14)] border-t-[var(--app-accent)]" />
    </div>
  );
}

function ErrorStateIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.18)] text-red-100">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M12 8v5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <circle cx="12" cy="16.5" fill="currentColor" r="1" />
        <path
          d="M10.29 3.86L1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function StateIcon({ tone }: { tone: StateTone }) {
  if (tone === "loading") {
    return <LoadingStateIcon />;
  }

  if (tone === "error") {
    return <ErrorStateIcon />;
  }

  return <EmptyStateIcon />;
}

export function StatePanel({ title, description, tone = "empty", action }: StatePanelProps) {
  const toneStyles = PANEL_TONE_STYLES[tone];

  return (
    <div
      aria-live={toneStyles.ariaLive}
      className={[
        "flex min-h-[164px] items-center justify-center rounded-[28px] border px-6 py-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        toneStyles.panelClassName
      ].join(" ")}
      data-tone={tone}
      role={toneStyles.role}
    >
      <div className="flex max-w-md flex-col items-center gap-3">
        <StateIcon tone={tone} />
        <p className={["text-base font-semibold", toneStyles.titleClassName].join(" ")}>{title}</p>
        {description ? (
          <p className={["text-sm leading-6", toneStyles.descriptionClassName].join(" ")}>
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
