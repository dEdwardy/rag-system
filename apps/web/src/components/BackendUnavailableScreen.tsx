import { useI18n } from "../i18n/I18nProvider";
import { resolveApiUrl } from "../lib/api";

export function BackendUnavailableScreen() {
  const { locale } = useI18n();
  const healthUrl = resolveApiUrl("/health");
  const isZh = locale === "zh";

  const title = isZh ? "工作区暂时无法连接后端" : "Workspace cannot reach the backend";
  const description = isZh
    ? "前端已经启动，但当前 API 服务还没有准备好。先启动后端，再回到这里继续文件上传、回答设置和对话。"
    : "The web app is up, but the API service is not ready yet. Start the backend first, then come back to continue file upload, answer setup, and chat.";

  const checklist = isZh
    ? [
        "确认本地 API 服务已经启动。",
        "访问健康检查地址，确认返回 200。",
        "后端恢复后重新检测当前页面。"
      ]
    : [
        "Start the local API service.",
        "Open the health endpoint and confirm it returns 200.",
        "Come back and re-check this workspace once the backend is ready."
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_38%),var(--app-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(18,23,39,0.96)_0%,rgba(11,15,26,0.98)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-[var(--app-border)] px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
              <div className="flex max-w-2xl flex-col gap-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded-full border border-[rgba(99,102,241,0.28)] bg-[rgba(99,102,241,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c7d2fe]">
                    {isZh ? "启动检查" : "Startup check"}
                  </span>
                  <span className="text-xs font-medium text-[var(--app-text-muted)]">
                    {isZh ? "RAG System workspace" : "RAG System workspace"}
                  </span>
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text)] sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--app-text-secondary)] sm:text-[15px]">
                    {description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {checklist.map((item, index) => (
                    <div
                      className="rounded-[22px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                      key={item}
                    >
                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(99,102,241,0.16)] text-sm font-semibold text-[#c7d2fe]">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-[var(--app-text-secondary)]">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-300 hover:bg-[var(--app-accent-strong)]"
                    onClick={() => window.location.reload()}
                    type="button"
                  >
                    {isZh ? "重新检测后端" : "Check again"}
                  </button>
                  <a
                    className="inline-flex items-center justify-center rounded-full border border-[var(--app-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--app-text-secondary)] transition duration-300 hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                    href={healthUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {isZh ? "打开健康检查" : "Open health endpoint"}
                  </a>
                </div>
              </div>
            </div>

            <div className="px-6 py-8 sm:px-8 lg:px-8 lg:py-10">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="rounded-[24px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                    {isZh ? "当前状态" : "Current state"}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="relative inline-flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400/35 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-300" />
                    </span>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {isZh ? "API 当前不可达" : "API is currently unreachable"}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text-secondary)]">
                    {isZh
                      ? "这通常表示本地后端还没启动，或者启动后还没完成初始化。"
                      : "This usually means the local backend is not running yet, or it is still booting."}
                  </p>
                </div>

                <div className="rounded-[24px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                    {isZh ? "健康检查地址" : "Health endpoint"}
                  </p>
                  <div className="mt-3 rounded-[18px] border border-[var(--app-border)] bg-[rgba(7,10,19,0.72)] px-4 py-3">
                    <code className="block break-all text-sm text-[#dbe4ff]">{healthUrl}</code>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text-secondary)]">
                    {isZh
                      ? "如果这个地址能返回 200，说明后端已恢复，刷新页面即可回到正常工作区。"
                      : "Once this endpoint returns 200, refresh the page and the workspace should recover normally."}
                  </p>
                </div>

                <p className="text-xs leading-6 text-[var(--app-text-muted)]">
                  {isZh
                    ? "这个状态不会影响前端构建本身，只是当前工作区还拿不到 API 数据。"
                    : "This does not mean the frontend build is broken. The workspace just cannot fetch API data yet."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
