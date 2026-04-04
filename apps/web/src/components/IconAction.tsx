import { Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";

type IconActionSharedProps = {
  children: React.ReactNode;
  label: string;
  disabledHint?: string;
};

const ICON_ACTION_BASE_CLASSNAME =
  "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] transition duration-300 ease-out";

export function IconActionButton({
  children,
  disabledHint,
  label,
  onClick
}: IconActionSharedProps & {
  onClick?: () => void;
}) {
  const isDisabled = onClick == null;
  const className = [
    ICON_ACTION_BASE_CLASSNAME,
    isDisabled
      ? "cursor-default text-[var(--app-text-muted)] opacity-70"
      : "cursor-pointer text-[var(--app-text-secondary)] hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
  ].join(" ");

  return (
    <Tooltip label={isDisabled ? disabledHint ?? label : label} openDelay={120} withArrow>
      <button
        aria-label={label}
        className={className}
        disabled={isDisabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function IconActionLink({ children, label, to }: IconActionSharedProps & { to: string }) {
  return (
    <Tooltip label={label} openDelay={120} withArrow>
      <Link
        aria-label={label}
        className={`${ICON_ACTION_BASE_CLASSNAME} cursor-pointer text-[var(--app-text-secondary)] hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]`}
        to={to}
      >
        {children}
      </Link>
    </Tooltip>
  );
}
