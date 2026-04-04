import { Navigate } from "react-router-dom";
import { BackendUnavailableScreen } from "../components/BackendUnavailableScreen";
import { useAuthMe } from "../features/api/hooks";
import { isApiUnavailableError, type ApiRequestError } from "../lib/api";
import { AppShell } from "./AppShell";

export function AuthenticatedAppShell() {
  const authMeQuery = useAuthMe();

  if (authMeQuery.isPending) {
    return null;
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
