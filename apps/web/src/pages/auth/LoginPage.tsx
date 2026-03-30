import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthMe, useLogin } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import { resolveApiUrl } from "../../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const authMeQuery = useAuthMe();
  const loginMutation = useLogin();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const githubOauthStartUrl = resolveApiUrl("/auth/oauth/github/start");
  const googleOauthStartUrl = resolveApiUrl("/auth/oauth/google/start");
  const oidcOauthStartUrl = resolveApiUrl("/auth/oauth/oidc/start");

  if (authMeQuery.data?.identity != null) {
    return <Navigate replace to="/" />;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    loginMutation.mutate(
      {
        email: email.trim(),
        password
      },
      {
        onSuccess: () => {
          navigate("/", { replace: true });
        }
      }
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <form
        className="w-full max-w-md rounded-[24px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
        onSubmit={onSubmit}
      >
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{t("auth.login.brand")}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text)]">{t("auth.login.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{t("auth.login.subtitle")}</p>
        </div>

        <label className="mt-5 block text-sm text-[var(--app-text-secondary)]" htmlFor="email">
          {t("auth.login.email")}
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[var(--app-accent)]"
          autoComplete="email"
          id="email"
          name="email"
          onChange={event => setEmail(event.target.value)}
          placeholder={t("auth.login.emailPlaceholder")}
          spellCheck={false}
          type="email"
          value={email}
        />

        <label className="mt-4 block text-sm text-[var(--app-text-secondary)]" htmlFor="password">
          {t("auth.login.password")}
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[var(--app-accent)]"
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={event => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />

        <div className="mt-5 space-y-2">
          <a
            className="block w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-center text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]"
            href={githubOauthStartUrl}
          >
            {t("auth.login.continueWithGitHub")}
          </a>
          <a
            className="block w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-center text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]"
            href={googleOauthStartUrl}
          >
            {t("auth.login.continueWithGoogle")}
          </a>
          <a
            className="block w-full rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-center text-sm text-[var(--app-text)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]"
            href={oidcOauthStartUrl}
          >
            {t("auth.login.continueWithOidc")}
          </a>
        </div>

        {loginMutation.error ? (
          <p aria-live="polite" className="mt-3 text-sm text-red-400" role="alert">{loginMutation.error.message}</p>
        ) : null}

        <button
          className="mt-5 w-full rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[var(--app-accent-strong)] hover:shadow-[0_10px_24px_var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loginMutation.isPending}
          type="submit"
        >
          {loginMutation.isPending ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
    </div>
  );
}
