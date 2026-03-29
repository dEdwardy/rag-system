import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthMe, useLogin } from "../../features/api/hooks";

export function LoginPage() {
  const navigate = useNavigate();
  const authMeQuery = useAuthMe();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">Sign in with your local account.</p>

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
            className="w-full rounded-md border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled
            type="button"
          >
            Continue with GitHub (coming soon)
          </button>
          <button
            className="w-full rounded-md border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled
            type="button"
          >
            Continue with Google (coming soon)
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
