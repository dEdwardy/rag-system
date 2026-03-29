import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthMe, useAuthProviders, useLogin } from "../../features/api/hooks";
import { resolveApiUrl } from "../../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const authMeQuery = useAuthMe();
  const authProvidersQuery = useAuthProviders();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const githubOauthStartUrl = resolveApiUrl("/auth/oauth/github/start");
  const googleOauthStartUrl = resolveApiUrl("/auth/oauth/google/start");
  const oidcOauthStartUrl = resolveApiUrl("/auth/oauth/oidc/start");
  const defaultCredentials = authProvidersQuery.data?.local.defaultCredentials ?? null;
  const githubConfigured = authProvidersQuery.data?.oauth.github.configured ?? true;
  const googleConfigured = authProvidersQuery.data?.oauth.google.configured ?? true;
  const oidcConfigured = authProvidersQuery.data?.oauth.oidc.configured ?? true;

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
      <form className="w-full max-w-md rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6" onSubmit={onSubmit}>
        <h1 className="text-xl font-semibold text-[var(--app-text)]">Login</h1>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">Sign in with your local account or continue with a provider.</p>

        {defaultCredentials ? (
          <div className="mt-4 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-sm text-[var(--app-text-secondary)]">
            <p className="font-medium text-[var(--app-text)]">Local dev account</p>
            <p className="mt-1 break-all">{defaultCredentials.email} / {defaultCredentials.password}</p>
            <button
              className="mt-3 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-bg-elevated)]"
              onClick={() => {
                setEmail(defaultCredentials.email);
                setPassword(defaultCredentials.password);
              }}
              type="button"
            >
              Use dev credentials
            </button>
          </div>
        ) : null}

        <label className="mt-5 block text-sm text-[var(--app-text-secondary)]" htmlFor="email">
          Email
        </label>
        <input
          className="mt-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          autoComplete="email"
          id="email"
          onChange={event => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />

        <label className="mt-4 block text-sm text-[var(--app-text-secondary)]" htmlFor="password">
          Password
        </label>
        <input
          className="mt-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          autoComplete="current-password"
          id="password"
          onChange={event => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />

        <div className="mt-5 space-y-2">
          <button
            className="w-full rounded-md border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!githubConfigured}
            onClick={() => {
              window.location.assign(githubOauthStartUrl);
            }}
            type="button"
          >
            {githubConfigured ? "Continue with GitHub" : "GitHub setup required"}
          </button>
          <button
            className="w-full rounded-md border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!googleConfigured}
            onClick={() => {
              window.location.assign(googleOauthStartUrl);
            }}
            type="button"
          >
            {googleConfigured ? "Continue with Google" : "Google setup required"}
          </button>
          <button
            className="w-full rounded-md border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!oidcConfigured}
            onClick={() => {
              window.location.assign(oidcOauthStartUrl);
            }}
            type="button"
          >
            {oidcConfigured ? "Continue with OIDC" : "OIDC setup required"}
          </button>
        </div>

        {loginMutation.error ? (
          <p className="mt-3 text-sm text-red-400">{loginMutation.error.message}</p>
        ) : null}

        <button
          className="mt-5 w-full rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={loginMutation.isPending}
          type="submit"
        >
          {loginMutation.isPending ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
