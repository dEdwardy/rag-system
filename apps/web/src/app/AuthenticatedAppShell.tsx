import { Navigate } from "react-router-dom";
import { BackendUnavailableScreen } from "../components/BackendUnavailableScreen";
import { useAuthMe } from "../features/api/hooks";
import { isApiUnavailableError, type ApiRequestError } from "../lib/api";
import { isInviteGateAccepted } from "../lib/invite-gate";
import { AppShell } from "./AppShell";

export function AuthenticatedAppShell() {
  const hasInviteAccess = isInviteGateAccepted();
  const authMeQuery = useAuthMe(hasInviteAccess);

  if (!hasInviteAccess) {
    return <Navigate replace to="/invite" />;
  }

  if (authMeQuery.isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-accent)] animate-spin" />
          <div>
            <p className="text-sm font-medium text-[var(--app-text)]">Loading workspace</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Checking your session and preparing the app shell.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isUnauthorized(authMeQuery.error)) {
    return <Navigate replace to="/login" />;
  }

  if (isApiUnavailableError(authMeQuery.error)) {
    return <BackendUnavailableScreen />;
  }

  if (authMeQuery.isError) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--app-text-muted)]">
        {authMeQuery.error.message}
      </div>
    );
  }

  if (authMeQuery.data?.identity == null) {
    return <Navigate replace to="/login" />;
  }

  return <AppShell currentIdentity={authMeQuery.data.currentIdentity} loginProvenance={authMeQuery.data.loginProvenance} />;
}

function isUnauthorized(error: unknown) {
  return typeof error === "object" && error != null && (error as ApiRequestError).status === 401;
}
