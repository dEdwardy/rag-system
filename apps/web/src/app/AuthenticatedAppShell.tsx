import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { BackendUnavailableScreen } from '../components/BackendUnavailableScreen';
import { useAuthMe } from '../features/api/hooks';
import { isApiUnavailableError, type ApiRequestError } from '../lib/api';
import { isInviteGateAccepted } from '../lib/invite-gate';
import {
  readLoginRedirectNotice,
  storeLoginRedirectNotice
} from '../lib/login-redirect-notice';
import { useI18n } from '../i18n/I18nProvider';
import { AppShell } from './AppShell';

export function AuthenticatedAppShell() {
  const hasInviteAccess = isInviteGateAccepted();
  const authMeQuery = useAuthMe(hasInviteAccess);
  const sessionExpired = isUnauthorized(authMeQuery.error);
  const { t } = useI18n();

  useEffect(() => {
    if (!sessionExpired) {
      return;
    }

    if (readLoginRedirectNotice(window.sessionStorage) != null) {
      return;
    }

    storeLoginRedirectNotice(window.sessionStorage, 'expired');
  }, [sessionExpired]);

  if (!hasInviteAccess) {
    return <Navigate replace to="/invite" />;
  }

  if (authMeQuery.isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-accent)] animate-spin" />
          <div>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {t('appShell.copy.loadingWorkspace')}
            </p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              {t('appShell.copy.preparingWorkspaceShell')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (sessionExpired) {
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

  return (
    <AppShell
      currentIdentity={authMeQuery.data.currentIdentity}
      loginProvenance={authMeQuery.data.loginProvenance}
    />
  );
}

function isUnauthorized(error: unknown) {
  return (
    typeof error === 'object' &&
    error != null &&
    (error as ApiRequestError).status === 401
  );
}
