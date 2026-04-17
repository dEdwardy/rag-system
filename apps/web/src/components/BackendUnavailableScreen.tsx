import { useI18n } from '../i18n/I18nProvider';
import { messages as zhMessages } from '../i18n/messages.zh';
import { resolveApiUrl } from '../lib/api';

export function BackendUnavailableScreen() {
  const { locale } = useI18n();
  const healthUrl = resolveApiUrl('/health');
  const englishCopy = {
    title: 'Workspace cannot reach the backend',
    description:
      'The web app is up, but the API service is not ready yet. Start the backend first, then come back to continue file upload, answer setup, and chat.',
    checklist: {
      first: 'Start the local API service.',
      second: 'Open the health endpoint and confirm it returns 200.',
      third: 'Come back and re-check this workspace once the backend is ready.'
    },
    startupCheck: 'Startup check',
    currentState: 'Current state',
    apiUnreachable: 'API is currently unreachable',
    apiUnreachableDescription:
      'This usually means the local backend is not running yet, or it is still booting.',
    healthEndpoint: 'Health endpoint',
    checkAgain: 'Check again',
    openHealthEndpoint: 'Open health endpoint',
    recoveryNote:
      'Once this endpoint returns 200, refresh the page and the workspace should recover normally.',
    buildNote:
      'This does not mean the frontend build is broken. The workspace just cannot fetch API data yet.'
  } as const;
  const copy =
    locale === 'zh' ? zhMessages.auth.backendUnavailable : englishCopy;
  const checklist = [
    copy.checklist.first,
    copy.checklist.second,
    copy.checklist.third
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[24px] border border-[var(--app-border)] bg-[rgba(15,23,42,0.82)] shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-sm">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-[var(--app-border)] px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
              <div className="flex max-w-2xl flex-col gap-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded-full border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">
                    {copy.startupCheck}
                  </span>
                  <span className="text-xs font-medium text-[var(--app-text-muted)]">
                    RAG System workspace
                  </span>
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text)] sm:text-4xl">
                    {copy.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--app-text-secondary)] sm:text-[15px]">
                    {copy.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {checklist.map((item, index) => (
                    <div
                      className="rounded-[18px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] px-4 py-4"
                      key={item}
                    >
                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-sm font-semibold text-[var(--app-text)]">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-[var(--app-text-secondary)]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-300 hover:bg-[var(--app-accent-strong)]"
                    onClick={() => window.location.reload()}
                    type="button"
                  >
                    {copy.checkAgain}
                  </button>
                  <a
                    className="inline-flex items-center justify-center rounded-full border border-[var(--app-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--app-text-secondary)] transition duration-300 hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                    href={healthUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {copy.openHealthEndpoint}
                  </a>
                </div>
              </div>
            </div>

            <div className="px-6 py-8 sm:px-8 lg:px-8 lg:py-10">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="rounded-[18px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                    {copy.currentState}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="relative inline-flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400/35 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-300" />
                    </span>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {copy.apiUnreachable}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text-secondary)]">
                    {copy.apiUnreachableDescription}
                  </p>
                </div>

                <div className="rounded-[18px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
                    {copy.healthEndpoint}
                  </p>
                  <div className="mt-3 rounded-[18px] border border-[var(--app-border)] bg-[rgba(7,10,19,0.72)] px-4 py-3">
                    <code className="block break-all text-sm text-[#dbe4ff]">
                      {healthUrl}
                    </code>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text-secondary)]">
                    {copy.recoveryNote}
                  </p>
                </div>

                <p className="text-xs leading-6 text-[var(--app-text-muted)]">
                  {copy.buildNote}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
