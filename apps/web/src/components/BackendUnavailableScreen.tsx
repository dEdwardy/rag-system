import { StatePanel } from "./StatePanel";
import { useI18n } from "../i18n/I18nProvider";
import { resolveApiUrl } from "../lib/api";

export function BackendUnavailableScreen() {
  const { locale } = useI18n();
  const healthUrl = resolveApiUrl("/health");
  const title = locale === "zh" ? "后端服务未启动" : "Backend service unavailable";
  const description = locale === "zh"
    ? `当前无法连接 API。请先启动后端服务，然后刷新页面。健康检查地址：${healthUrl}`
    : `The app cannot reach the API right now. Start the backend service and refresh the page. Health check: ${healthUrl}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="w-full max-w-2xl">
        <StatePanel
          action={(
            <button
              className="inline-flex items-center justify-center rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[#c7d2fe] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
              onClick={() => window.location.reload()}
              type="button"
            >
              {locale === "zh" ? "重新检测" : "Try again"}
            </button>
          )}
          description={description}
          title={title}
          tone="error"
        />
      </div>
    </div>
  );
}
