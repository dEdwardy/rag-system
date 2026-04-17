import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { messages as enMessages } from '../../i18n/messages.en';
import { messages as zhMessages } from '../../i18n/messages.zh';
import { useOutletContext } from 'react-router-dom';
import type { AppShellOutletContext } from '../../app/AppShell';

type OauthWorkspaceWelcomeProps = {
  context: 'chat' | 'knowledge' | 'assistant';
  documentCount: number;
  conversationCount?: number;
  assistantCount?: number;
};

type WelcomeAction = {
  label: string;
  to: string;
  tone: 'primary' | 'secondary';
};

type WelcomeStep = {
  label: string;
  hint: string;
  state: 'done' | 'current' | 'upcoming';
};

type WelcomeCopy = {
  kicker: string;
  title: string;
  description: string;
  pills: string[];
  actions: WelcomeAction[];
  steps?: WelcomeStep[];
};

export function OauthWorkspaceWelcome({
  context,
  documentCount,
  conversationCount = 0,
  assistantCount = 0
}: OauthWorkspaceWelcomeProps) {
  const { locale } = useI18n();
  const { loginProvenance } = useOutletContext<AppShellOutletContext>();

  if (loginProvenance.type !== 'oauth_session') {
    return null;
  }

  if (context === 'knowledge' && documentCount > 0) {
    return null;
  }

  if (context !== 'knowledge' && documentCount > 0 && conversationCount > 0) {
    return null;
  }

  const providerLabel = loginProvenance.oauthProvider?.toUpperCase() ?? 'OAuth';
  const source =
    locale === 'zh'
      ? zhMessages.auth.oauthWorkspaceWelcome
      : enMessages.auth.oauthWorkspaceWelcome;
  const workspaceLibraryLabel =
    locale === 'zh'
      ? zhMessages.appShell.copy.currentKnowledgeBase
      : enMessages.appShell.copy.currentKnowledgeBase;
  const copy = buildOauthWelcomeCopy(source, {
    context,
    providerLabel,
    documentCount,
    conversationCount,
    assistantCount,
    workspaceLibraryLabel
  });

  return (
    <section className="overflow-hidden rounded-[24px] border border-[rgba(99,102,241,0.22)] bg-[linear-gradient(135deg,rgba(99,102,241,0.16)_0%,rgba(15,23,42,0.92)_55%,rgba(14,165,233,0.12)_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(191,219,254,0.2)] bg-[rgba(15,23,42,0.32)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c7d2fe]">
            <span className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_0_6px_rgba(56,189,248,0.12)]" />
            {copy.kicker}
          </div>
          <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-white">
            {copy.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(226,232,240,0.84)]">
            {copy.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.pills.map((pill) => (
              <span
                className="rounded-full border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.34)] px-3 py-1 text-[11px] font-medium text-[rgba(226,232,240,0.82)]"
                key={pill}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {copy.actions.map((action) => (
            <Link
              className={[
                'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition duration-300',
                action.tone === 'primary'
                  ? 'bg-white text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.12)] hover:-translate-y-0.5'
                  : 'border border-[rgba(191,219,254,0.2)] bg-[rgba(15,23,42,0.28)] text-white hover:-translate-y-0.5 hover:bg-[rgba(30,41,59,0.52)]'
              ].join(' ')}
              key={`${action.to}-${action.label}`}
              to={action.to}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {copy.steps?.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {copy.steps.map((step, index) => {
            const stepTone =
              step.state === 'done'
                ? 'border-[rgba(74,222,128,0.28)] bg-[rgba(22,101,52,0.18)] text-[#dcfce7]'
                : step.state === 'current'
                  ? 'border-[rgba(129,140,248,0.32)] bg-[rgba(79,70,229,0.18)] text-white'
                  : 'border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.28)] text-[rgba(226,232,240,0.86)]';

            return (
              <div
                className={[
                  'rounded-[18px] border px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.16)]',
                  stepTone
                ].join(' ')}
                key={`${index}-${step.label}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-black/10 text-[11px] font-semibold">
                    {index + 1}
                  </div>
                  <div className="text-sm font-semibold">{step.label}</div>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-inherit/80">
                  {step.hint}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function buildOauthWelcomeCopy(
  source: any,
  input: {
    context: OauthWorkspaceWelcomeProps['context'];
    providerLabel: string;
    documentCount: number;
    conversationCount: number;
    assistantCount: number;
    workspaceLibraryLabel: string;
  }
): WelcomeCopy {
  if (input.context === 'knowledge') {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: source.knowledge.kicker.replace(
        '{provider}',
        input.providerLabel
      ),
      title:
        input.documentCount > 0
          ? source.knowledge.titleWithDocuments
          : source.knowledge.titleWithoutDocuments,
      description:
        input.documentCount > 0
          ? hasAssistant
            ? source.knowledge.descriptionWithDocumentsWithAssistant
            : source.knowledge.descriptionWithDocumentsWithoutAssistant
          : hasAssistant
            ? source.knowledge.descriptionWithoutDocumentsWithAssistant
            : source.knowledge.descriptionWithoutDocumentsWithoutAssistant,
      pills: [
        hasAssistant
          ? source.knowledge.answerSetupReady
          : source.knowledge.answerSetupPending,
        input.workspaceLibraryLabel,
        source.knowledge.documentsAvailable.replace(
          '{count}',
          String(input.documentCount)
        )
      ],
      actions: [
        {
          label: source.knowledge.actionUploadDocuments,
          to: '/documents',
          tone: 'primary' as const
        },
        {
          label: hasAssistant
            ? source.knowledge.actionOpenAnswerSettings
            : source.knowledge.actionReviewAnswerSettings,
          to: '/assistant',
          tone: 'secondary' as const
        }
      ]
    };
  }

  if (input.context === 'assistant') {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: source.assistant.kicker.replace(
        '{provider}',
        input.providerLabel
      ),
      title: hasAssistant
        ? source.assistant.titleWithAssistant
        : source.assistant.titleWithoutAssistant,
      description: !hasAssistant
        ? source.assistant.descriptionWithoutAssistant
        : input.documentCount === 0
          ? source.assistant.descriptionWithoutDocuments
          : source.assistant.descriptionDefault,
      pills: [
        hasAssistant
          ? source.assistant.answerSetupReady
          : source.assistant.answerSetupPending,
        input.workspaceLibraryLabel,
        source.assistant.conversations.replace(
          '{count}',
          String(input.conversationCount)
        )
      ],
      actions: [
        {
          label:
            input.documentCount === 0
              ? source.assistant.actionUploadDocuments
              : source.assistant.actionOpenChat,
          to: input.documentCount === 0 ? '/documents' : '/',
          tone: 'primary' as const
        },
        {
          label: source.assistant.actionOpenWorkspaceSettings,
          to: '/knowledge-base',
          tone: 'secondary' as const
        }
      ]
    };
  }

  const hasDocuments = input.documentCount > 0;
  const hasAnswerSettings = input.assistantCount > 0;

  return {
    kicker: source.chat.kicker.replace('{provider}', input.providerLabel),
    title: !hasDocuments
      ? source.chat.titleNoDocuments
      : !hasAnswerSettings
        ? source.chat.titleNoAnswerSettings
        : source.chat.titleReady,
    description: !hasDocuments
      ? source.chat.descriptionNoDocuments
      : !hasAnswerSettings
        ? source.chat.descriptionNoAnswerSettings
        : input.conversationCount === 0
          ? source.chat.descriptionNoConversations
          : source.chat.descriptionReady,
    pills: [
      source.chat.currentWorkspaceChat,
      input.workspaceLibraryLabel,
      source.chat.conversations.replace(
        '{count}',
        String(input.conversationCount)
      )
    ],
    actions: [
      {
        label: !hasDocuments
          ? source.chat.actionUploadFiles
          : !hasAnswerSettings
            ? source.chat.actionOpenAnswerSettings
            : source.chat.actionStartChatting,
        to: !hasDocuments
          ? '/documents'
          : !hasAnswerSettings
            ? '/assistant'
            : '/',
        tone: 'primary' as const
      },
      {
        label: source.chat.actionOpenWorkspaceSettings,
        to: '/knowledge-base',
        tone: 'secondary' as const
      }
    ],
    steps: [
      {
        label: source.chat.stepAddLibraryItems,
        hint: hasDocuments
          ? source.chat.stepAddLibraryItemsDone
          : source.chat.stepAddLibraryItemsPending,
        state: hasDocuments ? 'done' : 'current'
      },
      {
        label: source.chat.stepReviewAnswerSettings,
        hint: hasAnswerSettings
          ? source.chat.stepReviewAnswerSettingsDone
          : hasDocuments
            ? source.chat.stepReviewAnswerSettingsWithDocs
            : source.chat.stepReviewAnswerSettingsPending,
        state: hasAnswerSettings
          ? 'done'
          : hasDocuments
            ? 'current'
            : 'upcoming'
      },
      {
        label: source.chat.stepStartChatting,
        hint:
          hasDocuments && hasAnswerSettings
            ? source.chat.stepStartChattingDone
            : source.chat.stepStartChattingPending,
        state: hasDocuments && hasAnswerSettings ? 'current' : 'upcoming'
      }
    ]
  };
}
