import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthMe, useLogin } from "../../features/api/hooks";

export function LoginPage() {
  const navigate = useNavigate();
  const authMeQuery = useAuthMe();
  const loginMutation = useLogin();
  const [userId, setUserId] = useState("");

  if (authMeQuery.data?.identity != null) {
    return <Navigate replace to="/" />;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUserId = userId.trim();
    loginMutation.mutate(
      {
        userId: trimmedUserId.length > 0 ? trimmedUserId : undefined
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
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">Use the seeded default user by leaving User ID empty.</p>

        <label className="mt-5 block text-sm text-[var(--app-text-secondary)]" htmlFor="userId">
          User ID
        </label>
        <input
          className="mt-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          id="userId"
          onChange={event => setUserId(event.target.value)}
          placeholder="default-user"
          type="text"
          value={userId}
        />

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
