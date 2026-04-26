import { FormEvent, startTransition, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  useAuthMe,
  useAuthProviders,
  useLogin
} from '../../features/api/hooks';
import { BackendUnavailableScreen } from '../../components/BackendUnavailableScreen';
import { useI18n } from '../../i18n/I18nProvider';
import { isApiUnavailableError, resolveApiUrl } from '../../lib/api';
import {
  getPrivateBetaDefaultCredentials,
  isInviteGateAccepted
} from '../../lib/invite-gate';

export function LoginPage() {
  const navigate = useNavigate();
  const hasInviteAccess = isInviteGateAccepted();
  const authMeQuery = useAuthMe(hasInviteAccess);
  const authProvidersQuery = useAuthProviders(hasInviteAccess);
  const loginMutation = useLogin();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [transitionTarget, setTransitionTarget] = useState<
    null | 'github' | 'google' | 'oidc' | 'password'
  >(null);
  const isBusy = transitionTarget != null || loginMutation.isPending;
  const githubOauthStartUrl = resolveApiUrl('/auth/oauth/github/start');
  const googleOauthStartUrl = resolveApiUrl('/auth/oauth/google/start');
  const oidcOauthStartUrl = resolveApiUrl('/auth/oauth/oidc/start');
  const defaultCredentials =
    authProvidersQuery.data?.local.defaultCredentials ??
    getPrivateBetaDefaultCredentials();
  const githubConfigured =
    authProvidersQuery.data?.oauth.github.configured ?? true;
  const googleConfigured =
    authProvidersQuery.data?.oauth.google.configured ?? true;
  const oidcConfigured = authProvidersQuery.data?.oauth.oidc.configured ?? true;
  const authProvidersLoading =
    authProvidersQuery.isPending || authProvidersQuery.isFetching;

  useEffect(() => {
    if (!defaultCredentials) {
      return;
    }

    setEmail((current) =>
      current.length > 0 ? current : defaultCredentials.email
    );
    setPassword((current) =>
      current.length > 0 ? current : defaultCredentials.password
    );
  }, [defaultCredentials]);

  if (!hasInviteAccess) {
    return <Navigate replace to="/invite" />;
  }

  if (authMeQuery.data?.identity != null) {
    return <Navigate replace to="/" />;
  }

  if (
    isApiUnavailableError(authMeQuery.error) ||
    isApiUnavailableError(authProvidersQuery.error)
  ) {
    return <BackendUnavailableScreen />;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransitionTarget('password');

    loginMutation.mutate(
      {
        email: email.trim(),
        password
      },
      {
        onSuccess: () => {
          startTransition(() => {
            navigate('/', { replace: true });
          });
        },
        onError: () => {
          setTransitionTarget(null);
        }
      }
    );
  }

  function startOauthTransition(
    target: 'github' | 'google' | 'oidc',
    url: string
  ) {
    setTransitionTarget(target);
    startTransition(() => {
      window.location.assign(url);
    });
  }

  return (
    <div className="workspace-auth-surface relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <div
        className={`pointer-events-none absolute inset-0 bg-[var(--app-bg)] transition-opacity duration-240 ${
          transitionTarget ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <form
        className={`workspace-auth-panel relative w-full max-w-md rounded-[24px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-all duration-240 ${
          transitionTarget
            ? 'scale-[0.985] border-[var(--app-border-strong)]'
            : 'scale-100'
        }`}
        onSubmit={onSubmit}
      >
        {transitionTarget ? (
          <div className="absolute inset-0 z-10 rounded-[24px] border border-[rgba(255,255,255,0.04)] bg-[rgba(7,10,19,0.54)] backdrop-blur-[5px]">
            <div className="flex h-full items-center justify-center px-6">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-accent)]" />
                <p className="text-sm font-medium text-[var(--app-text)]">
                  {transitionTarget === 'password'
                    ? locale === 'zh'
                      ? '正在登录'
                      : 'Signing in'
                    : locale === 'zh'
                      ? '正在跳转到授权页面'
                      : 'Redirecting to the authorization page'}
                </p>
                <p className="text-xs text-[var(--app-text-muted)]">
                  {transitionTarget === 'password'
                    ? locale === 'zh'
                      ? '请稍候，正在验证你的会话。'
                      : 'Please wait while we verify your session.'
                    : locale === 'zh'
                      ? '即将打开第三方登录流程。'
                      : 'We are about to open the OAuth flow.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
            {t('auth.login.brand')}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--app-text)]">
            {t('auth.login.title')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {defaultCredentials ? (
          <div className="mt-4 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-sm text-[var(--app-text-secondary)]">
            <p className="font-medium text-[var(--app-text)]">
              {locale === 'zh' ? '内测默认账号' : 'Default beta account'}
            </p>
            <p className="mt-1 break-all">
              {defaultCredentials.email} / {defaultCredentials.password}
            </p>
            <button
              className="mt-3 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] transition-[background-color,border-color] duration-150 hover:bg-[var(--app-bg-elevated)]"
              onClick={() => {
                setEmail(defaultCredentials.email);
                setPassword(defaultCredentials.password);
              }}
              type="button"
            >
              {locale === 'zh' ? '填充默认账号' : 'Use default beta account'}
            </button>
          </div>
        ) : null}

        <label
          className="mt-5 block text-sm text-[var(--app-text-secondary)]"
          htmlFor="email"
        >
          {t('auth.login.email')}
        </label>
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('auth.login.emailPlaceholder')}
          spellCheck={false}
          type="email"
          value={email}
        />

        <label
          className="mt-4 block text-sm text-[var(--app-text-secondary)]"
          htmlFor="password"
        >
          {t('auth.login.password')}
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder={locale === 'zh' ? '请输入密码' : 'Enter your password'}
          type="password"
          value={password}
        />

        <div className="mt-5 space-y-2">
          <button
            className="w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={authProvidersLoading || !githubConfigured}
            onClick={() => {
              startOauthTransition('github', githubOauthStartUrl);
            }}
            type="button"
          >
            {authProvidersLoading
              ? t('auth.login.loadingProviders')
              : githubConfigured
                ? t('auth.login.continueWithGitHub')
                : t('auth.login.githubSetupRequired')}
          </button>
          <button
            className="w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={authProvidersLoading || !googleConfigured}
            onClick={() => {
              startOauthTransition('google', googleOauthStartUrl);
            }}
            type="button"
          >
            {authProvidersLoading
              ? t('auth.login.loadingProviders')
              : googleConfigured
                ? t('auth.login.continueWithGoogle')
                : t('auth.login.googleSetupRequired')}
          </button>
          <button
            className="w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={authProvidersLoading || !oidcConfigured}
            onClick={() => {
              startOauthTransition('oidc', oidcOauthStartUrl);
            }}
            type="button"
          >
            {authProvidersLoading
              ? t('auth.login.loadingProviders')
              : oidcConfigured
                ? t('auth.login.continueWithOidc')
                : t('auth.login.oidcSetupRequired')}
          </button>
        </div>

        {loginMutation.error ? (
          <p
            aria-live="polite"
            className="mt-3 text-sm text-red-400"
            role="alert"
          >
            {loginMutation.error.message}
          </p>
        ) : null}

        {isBusy ? (
          <p
            aria-live="polite"
            className="mt-3 text-xs text-[var(--app-text-muted)]"
          >
            {transitionTarget === 'password'
              ? locale === 'zh'
                ? '正在验证登录信息...'
                : 'Verifying credentials...'
              : locale === 'zh'
                ? '正在打开登录流程...'
                : 'Opening the sign-in flow...'}
          </p>
        ) : null}

        <button
          className="mt-5 w-full rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[var(--app-accent-strong)] hover:shadow-[0_10px_24px_var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          type="submit"
        >
          {loginMutation.isPending || transitionTarget === 'password'
            ? t('auth.login.submitting')
            : t('auth.login.submit')}
        </button>
      </form>
    </div>
  );
}
