import { Link } from "react-router-dom";
import { useAuthMe } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

type OauthWorkspaceWelcomeProps = {
  context: "chat" | "knowledge" | "assistant";
  documentCount: number;
  conversationCount?: number;
  assistantCount?: number;
};

type WelcomeAction = {
  label: string;
  to: string;
  tone: "primary" | "secondary";
};

type WelcomeStep = {
  label: string;
  hint: string;
  state: "done" | "current" | "upcoming";
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
  const authMeQuery = useAuthMe();
  const { locale } = useI18n();

  if (authMeQuery.data?.loginProvenance.type !== "oauth_session") {
    return null;
  }

  if (context === "knowledge" && documentCount > 0) {
    return null;
  }

  if (context !== "knowledge" && documentCount > 0 && conversationCount > 0) {
    return null;
  }

  const providerLabel = authMeQuery.data.loginProvenance.oauthProvider?.toUpperCase() ?? "OAuth";

  const copy =
    locale === "zh"
      ? buildChineseCopy({ context, providerLabel, documentCount, conversationCount, assistantCount })
      : buildEnglishCopy({ context, providerLabel, documentCount, conversationCount, assistantCount });

  return (
    <section className="overflow-hidden rounded-[24px] border border-[rgba(99,102,241,0.22)] bg-[linear-gradient(135deg,rgba(99,102,241,0.16)_0%,rgba(15,23,42,0.92)_55%,rgba(14,165,233,0.12)_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(191,219,254,0.2)] bg-[rgba(15,23,42,0.32)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c7d2fe]">
            <span className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_0_6px_rgba(56,189,248,0.12)]" />
            {copy.kicker}
          </div>
          <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-white">{copy.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(226,232,240,0.84)]">{copy.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.pills.map(pill => (
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
          {copy.actions.map(action => (
            <Link
              className={[
                "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition duration-300",
                action.tone === "primary"
                  ? "bg-white text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.12)] hover:-translate-y-0.5"
                  : "border border-[rgba(191,219,254,0.2)] bg-[rgba(15,23,42,0.28)] text-white hover:-translate-y-0.5 hover:bg-[rgba(30,41,59,0.52)]"
              ].join(" ")}
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
              step.state === "done"
                ? "border-[rgba(74,222,128,0.28)] bg-[rgba(22,101,52,0.18)] text-[#dcfce7]"
                : step.state === "current"
                  ? "border-[rgba(129,140,248,0.32)] bg-[rgba(79,70,229,0.18)] text-white"
                  : "border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.28)] text-[rgba(226,232,240,0.86)]";

            return (
              <div
                className={[
                  "rounded-[18px] border px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.16)]",
                  stepTone
                ].join(" ")}
                key={`${index}-${step.label}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-black/10 text-[11px] font-semibold">
                    {index + 1}
                  </div>
                  <div className="text-sm font-semibold">{step.label}</div>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-inherit/80">{step.hint}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function buildEnglishCopy(input: {
  context: OauthWorkspaceWelcomeProps["context"];
  providerLabel: string;
  documentCount: number;
  conversationCount: number;
  assistantCount: number;
}): WelcomeCopy {
  if (input.context === "knowledge") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} workspace setup`,
      title: input.documentCount > 0 ? "Your workspace library has real source material now." : "Start by setting up the current workspace library.",
      description:
        input.documentCount > 0
          ? hasAssistant
            ? "The current workspace library already has documents and at least one connected answer setup. Review the workspace or move on to asking questions."
            : "The current workspace library already has documents, but you should still review answer settings before treating chat as fully ready."
          : hasAssistant
            ? "A workspace library and assistant exist for this workspace, but retrieval will stay thin until you add source files."
            : "This workspace still needs the first source files, and you may also need to finish answer settings before asking questions.",
       pills: ["Current workspace library", `${input.assistantCount} answer setup connected`, `${input.documentCount} documents available`],
       actions: [
         { label: "Upload documents", to: "/documents", tone: "primary" as const },
         { label: hasAssistant ? "Open answer settings" : "Review answer settings", to: "/assistant", tone: "secondary" as const }
       ]
     };
  }

  if (input.context === "assistant") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} answer settings`,
      title: hasAssistant ? "Review the current answer settings before tuning further." : "This workspace still needs answer settings for the current library.",
      description:
        !hasAssistant
          ? "Answer settings in this product follow the current workspace library. Review the library and document state first, then restore or connect the same workspace answer setup."
          : input.documentCount === 0
            ? "Answer settings already exist, but the workspace library is still empty. Upload documents first, then come back to tune prompting and retrieval behavior."
            : "Answer settings already exist and the workspace library has material. Tune settings here only when you need to improve answer behavior or retrieval quality.",
      pills: [hasAssistant ? "Answer settings connected" : "Answer settings not ready", `${input.documentCount} documents available`, `${input.conversationCount} chats so far`],
      actions: [
        { label: input.documentCount === 0 ? "Upload documents" : "Open chat", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "Open workspace settings", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  const hasDocuments = input.documentCount > 0;
  const hasAnswerSettings = input.assistantCount > 0;

  return {
    kicker: `${input.providerLabel} chat workspace`,
    title:
      !hasDocuments
        ? "Chat still needs source material from the current library."
        : !hasAnswerSettings
          ? "One more step is still missing before chat is ready."
          : "The current workspace is ready to continue in chat.",
    description:
      !hasDocuments
        ? "Before treating chat as ready, upload files into the current workspace library so retrieval uses your own workspace material instead of an empty corpus."
        : !hasAnswerSettings
          ? "The workspace library already has material, but chat still needs answer settings for this same workspace before you can ask reliably."
        : input.conversationCount === 0
          ? "The current workspace has material available. Start the first conversation when you are ready to verify chat end to end."
          : "This workspace is already active. Continue the conversation or refine workspace settings and answer settings if answers still look off.",
    pills: ["Current workspace chat", `${input.documentCount} documents available`, `${input.conversationCount} conversations`],
    actions: [
      {
        label:
          !hasDocuments
          ? "Upload files"
            : !hasAnswerSettings
              ? "Open answer settings"
              : "Start chatting",
        to:
          !hasDocuments
            ? "/documents"
            : !hasAnswerSettings
              ? "/assistant"
              : "/",
        tone: "primary" as const
      },
      { label: "Open workspace settings", to: "/knowledge-base", tone: "secondary" as const }
    ],
    steps: [
      {
        label: "Add library items",
        hint: hasDocuments ? "Done. This workspace library already has source material." : "Upload the first files so chat has real workspace material to use.",
        state: hasDocuments ? "done" : "current"
      },
      {
        label: "Review answer settings",
        hint: hasAnswerSettings
          ? "Done. Answer settings are already connected to this workspace."
          : hasDocuments
            ? "This is the next step. Connect answer settings for the same workspace before chatting."
            : "This comes right after the first library items are ready.",
        state: hasAnswerSettings ? "done" : hasDocuments ? "current" : "upcoming"
      },
      {
        label: "Start chatting",
        hint:
          hasDocuments && hasAnswerSettings
            ? "Everything is ready. Use chat to verify the full answer flow."
            : "Once the first two steps are done, come back here and start the first conversation.",
        state: hasDocuments && hasAnswerSettings ? "current" : "upcoming"
      }
    ]
  };
}

function buildChineseCopy(input: {
  context: OauthWorkspaceWelcomeProps["context"];
  providerLabel: string;
  documentCount: number;
  conversationCount: number;
  assistantCount: number;
}): WelcomeCopy {
  if (input.context === "knowledge") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} 工作区设置`,
      title: input.documentCount > 0 ? "当前资料空间已经有可用资料了。" : "先把当前资料空间建立起来。",
      description:
        input.documentCount > 0
          ? hasAssistant
            ? "当前资料空间已经有文档，也至少连接了一套回答设置。现在更适合回看工作区状态，或者直接进入提问。"
            : "当前资料空间已经有文档，但在把 Chat 当成完全可用之前，仍然应该先确认回答设置。"
          : hasAssistant
            ? "当前工作区已经有资料空间和助手，但如果还没有文档，检索结果仍然会偏空。"
            : "当前工作区还缺第一批资料，而且在继续提问前，也可能还需要先补齐回答设置。",
       pills: ["当前资料空间", `已连接回答设置 ${input.assistantCount} 套`, `可用文档 ${input.documentCount} 份`],
       actions: [
         { label: "去上传文档", to: "/documents", tone: "primary" as const },
         { label: hasAssistant ? "打开回答设置" : "查看回答设置", to: "/assistant", tone: "secondary" as const }
       ]
     };
  }

  if (input.context === "assistant") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} 回答设置`,
      title: hasAssistant ? "先确认当前回答设置，再决定是否继续调参。" : "当前工作区还没有给这个资料空间准备回答设置。",
      description:
        !hasAssistant
          ? "这个产品里的回答设置始终跟随当前资料空间。先确认资料状态，再为同一个工作区上下文补齐或恢复回答设置。"
          : input.documentCount === 0
            ? "回答设置已经存在，但资料空间还是空的。先上传文档，再回来微调 prompt 和检索参数。"
            : "回答设置已经存在，资料空间里也有资料。只有在确实想改善回答风格或检索质量时，再继续调这些参数。",
      pills: [hasAssistant ? "回答设置已就绪" : "回答设置尚未就绪", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
      actions: [
        { label: input.documentCount === 0 ? "先上传文档" : "去聊天", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "打开工作区设置", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  const hasDocuments = input.documentCount > 0;
  const hasAnswerSettings = input.assistantCount > 0;

  return {
    kicker: `${input.providerLabel} 对话工作区`,
    title:
      !hasDocuments
        ? "Chat 还缺当前资料空间里的可检索资料。"
        : !hasAnswerSettings
          ? "在开始聊天前，还差最后一步。"
          : "当前工作区已经可以继续在 Chat 中使用。",
    description:
      !hasDocuments
        ? "在把 Chat 当成就绪前，先往当前资料空间里上传几份文档，这样检索才能落到你自己的工作区资料上，而不是空语料。"
        : !hasAnswerSettings
          ? "当前资料空间已经有资料，但在稳定提问前，仍然需要先为这个工作区补齐回答设置。"
        : input.conversationCount === 0
          ? "当前工作区已经有资料可用了。准备好后，直接开始第一轮对话即可验证整条链路。"
          : "当前工作区已经处于可用状态。你可以继续提问，或者回到工作区设置和助手页做进一步调整。",
    pills: ["当前工作区 Chat", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
    actions: [
      {
        label:
          !hasDocuments
            ? "去上传文档"
            : !hasAnswerSettings
              ? "打开回答设置"
              : "开始聊天",
        to:
          !hasDocuments
            ? "/documents"
            : !hasAnswerSettings
              ? "/assistant"
              : "/",
        tone: "primary" as const
      },
      { label: "打开工作区设置", to: "/knowledge-base", tone: "secondary" as const }
    ],
    steps: [
      {
        label: "添加资料",
        hint: hasDocuments ? "已完成。当前资料空间已经有可检索资料。" : "先上传第一批文件或链接，让 Chat 有真实资料可用。",
        state: hasDocuments ? "done" : "current"
      },
      {
        label: "确认回答设置",
        hint: hasAnswerSettings
          ? "已完成。当前工作区已经有可用的回答设置。"
          : hasDocuments
            ? "这就是下一步。先为同一个工作区补齐回答设置，再开始提问。"
            : "等第一批资料就绪后，再回来完成这一步。",
        state: hasAnswerSettings ? "done" : hasDocuments ? "current" : "upcoming"
      },
      {
        label: "开始聊天",
        hint:
          hasDocuments && hasAnswerSettings
            ? "现在已经可以开始提问，用第一轮对话验证整条链路。"
            : "前两步完成后，再回到这里开始第一轮对话。",
        state: hasDocuments && hasAnswerSettings ? "current" : "upcoming"
      }
    ]
  };
}
