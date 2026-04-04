import { Link } from "react-router-dom";
import { useAuthMe } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

type OauthWorkspaceWelcomeProps = {
  context: "chat" | "knowledge" | "assistant";
  documentCount: number;
  conversationCount?: number;
  assistantCount?: number;
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
    </section>
  );
}

function buildEnglishCopy(input: {
  context: OauthWorkspaceWelcomeProps["context"];
  providerLabel: string;
  documentCount: number;
  conversationCount: number;
  assistantCount: number;
}) {
  if (input.context === "knowledge") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} workspace setup`,
      title: input.documentCount > 0 ? "Your knowledge base has real source material now." : "Start by setting up the current knowledge base.",
      description:
        input.documentCount > 0
          ? hasAssistant
            ? "The current knowledge base already has documents and at least one bound assistant. Review the workspace or move on to asking questions."
            : "The current knowledge base already has documents, but you should still review assistant binding before treating chat as fully ready."
          : hasAssistant
            ? "A knowledge base and assistant exist for this workspace, but retrieval will stay thin until you add source files."
            : "This workspace still needs the first source files, and you may also need to finish assistant binding before asking questions.",
      pills: ["Current primary KB", `${input.assistantCount} assistant linked`, `${input.documentCount} documents available`],
      actions: [
        { label: "Upload documents", to: "/documents", tone: "primary" as const },
        { label: hasAssistant ? "Open assistant" : "Review assistant setup", to: "/assistant", tone: "secondary" as const }
      ]
    };
  }

  if (input.context === "assistant") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} assistant setup`,
      title: hasAssistant ? "Review the current assistant before tuning it further." : "This workspace still needs an assistant for the current KB.",
      description:
        !hasAssistant
          ? "Assistant setup in this product follows the current primary knowledge base. Review the KB and document state first, then restore or bind an assistant for the same workspace context."
          : input.documentCount === 0
            ? "The assistant exists, but the knowledge base is still empty. Upload documents first, then come back to tune prompting and retrieval behavior."
            : "The assistant exists and the knowledge base already has material. Tune settings here only when you need to improve answer behavior or retrieval quality.",
      pills: [hasAssistant ? "Assistant bound" : "Assistant not yet bound", `${input.documentCount} documents available`, `${input.conversationCount} chats so far`],
      actions: [
        { label: input.documentCount === 0 ? "Upload documents" : "Open chat", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "Open knowledge base", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  return {
    kicker: `${input.providerLabel} chat workspace`,
    title: input.documentCount === 0 ? "Chat still needs source material from the current KB." : "The current workspace is ready to continue in chat.",
    description:
      input.documentCount === 0
        ? "Before treating chat as ready, upload a few files into the current knowledge base so retrieval uses your own workspace material instead of an empty corpus."
        : input.conversationCount === 0
          ? "The current workspace has material available. Start the first conversation when you are ready to verify chat end to end."
          : "This workspace is already active. Continue the conversation or refine knowledge-base and assistant setup if answers still look off.",
    pills: ["Current workspace chat", `${input.documentCount} documents available`, `${input.conversationCount} conversations`],
    actions: [
      { label: input.documentCount === 0 ? "Upload documents" : "Start chatting", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
      { label: "Open knowledge base", to: "/knowledge-base", tone: "secondary" as const }
    ]
  };
}

function buildChineseCopy(input: {
  context: OauthWorkspaceWelcomeProps["context"];
  providerLabel: string;
  documentCount: number;
  conversationCount: number;
  assistantCount: number;
}) {
  if (input.context === "knowledge") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} 工作区设置`,
      title: input.documentCount > 0 ? "当前知识库已经有可用资料了。" : "先把当前知识库工作区建立起来。",
      description:
        input.documentCount > 0
          ? hasAssistant
            ? "当前知识库已经有文档，也至少绑定了一个助手。现在更适合回看工作区状态，或者直接进入提问。"
            : "当前知识库已经有文档，但在把 Chat 当成完全可用之前，仍然应该先确认助手绑定状态。"
          : hasAssistant
            ? "当前工作区已经有知识库和助手，但如果还没有文档，检索结果仍然会偏空。"
            : "当前工作区还缺第一批资料，而且在继续提问前，也可能还需要先补齐助手绑定。",
      pills: ["当前主知识库", `已绑定助手 ${input.assistantCount} 个`, `可用文档 ${input.documentCount} 份`],
      actions: [
        { label: "去上传文档", to: "/documents", tone: "primary" as const },
        { label: hasAssistant ? "打开助手页" : "查看助手设置", to: "/assistant", tone: "secondary" as const }
      ]
    };
  }

  if (input.context === "assistant") {
    const hasAssistant = input.assistantCount > 0;
    return {
      kicker: `${input.providerLabel} 助手设置`,
      title: hasAssistant ? "先确认当前助手，再决定是否继续调参。" : "当前工作区还没有给这个知识库绑定助手。",
      description:
        !hasAssistant
          ? "这个产品里的助手配置始终跟随当前主知识库。先确认知识库和文档状态，再为同一个工作区上下文补齐或恢复助手绑定。"
          : input.documentCount === 0
            ? "助手已经存在，但知识库还是空的。先上传文档，再回来微调 prompt 和检索参数。"
            : "助手已经存在，知识库里也有资料。只有在确实想改善回答风格或检索质量时，再继续调这些参数。",
      pills: [hasAssistant ? "已绑定助手" : "尚未绑定助手", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
      actions: [
        { label: input.documentCount === 0 ? "先上传文档" : "去聊天", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "查看知识库", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  return {
    kicker: `${input.providerLabel} 对话工作区`,
    title: input.documentCount === 0 ? "Chat 还缺当前知识库里的可检索资料。" : "当前工作区已经可以继续在 Chat 中使用。",
    description:
      input.documentCount === 0
        ? "在把 Chat 当成就绪前，先往当前知识库里上传几份文档，这样检索才能落到你自己的工作区资料上，而不是空语料。"
        : input.conversationCount === 0
          ? "当前工作区已经有资料可用了。准备好后，直接开始第一轮对话即可验证整条链路。"
          : "当前工作区已经处于可用状态。你可以继续提问，或者回到知识库和助手页做进一步调整。",
    pills: ["当前工作区 Chat", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
    actions: [
      { label: input.documentCount === 0 ? "去上传文档" : "开始聊天", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
      { label: "打开知识库", to: "/knowledge-base", tone: "secondary" as const }
    ]
  };
}
