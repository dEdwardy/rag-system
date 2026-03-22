import type { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  description?: string;
  tone?: "empty" | "error" | "loading";
  action?: ReactNode;
};

export function StatePanel({ title, description, tone = "empty", action }: StatePanelProps) {
  if (tone === "loading") {
    return (
      <div aria-live="polite" className="flex min-h-[148px] items-center justify-center rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(30,30,38,0.98)_0%,rgba(24,24,31,0.98)_100%)] px-6 py-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]" role="status">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.14)] border-t-[var(--app-accent)]" />
          <p className="text-sm font-semibold text-[var(--app-text)]">{title}</p>
          {description ? (
            <p className="max-w-sm text-sm text-[var(--app-text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (tone === "error") {
    return (
      <div aria-live="assertive" className="rounded-[24px] border border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.14)] px-5 py-4 text-red-100 shadow-[0_8px_24px_rgba(0,0,0,0.18)]" role="alert">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-red-100/80">{description}</p>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    );
  }

  return (
    <div aria-live="polite" className="flex min-h-[190px] items-center justify-center rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(30,30,38,0.98)_0%,rgba(24,24,31,0.98)_100%)] px-6 py-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]" role="status">
      <div className="flex flex-col items-center gap-2">
        <p className="text-base font-semibold text-[var(--app-text)]">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
