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
    return {
      kicker: `${input.providerLabel} workspace ready`,
      title: "Your personal knowledge workspace is provisioned.",
      description:
        input.assistantCount > 0
          ? "We already created a personal knowledge base and assistant for this OAuth account. Add source files first so retrieval has real material to work with."
          : "We created your personal knowledge base. Add source files first, then the assistant workspace will have material to retrieve from.",
      pills: ["Personal knowledge base", `${input.assistantCount} assistant ready`, `${input.documentCount} documents indexed`],
      actions: [
        { label: "Upload documents", to: "/documents", tone: "primary" as const },
        { label: "Open assistant", to: "/assistant", tone: "secondary" as const }
      ]
    };
  }

  if (input.context === "assistant") {
    return {
      kicker: `${input.providerLabel} assistant ready`,
      title: "Your assistant is configured for this account.",
      description:
        input.documentCount === 0
          ? "The assistant and retrieval profile are ready, but the knowledge base is still empty. Upload documents first, then come back to tune prompting and retrieval behavior."
          : "The assistant is ready. You can tune prompt and retrieval settings here, then jump back to chat for the first OAuth session run.",
      pills: ["Assistant provisioned", `${input.documentCount} documents available`, `${input.conversationCount} chats so far`],
      actions: [
        { label: input.documentCount === 0 ? "Upload documents" : "Open chat", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "Open knowledge base", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  return {
    kicker: `${input.providerLabel} chat workspace ready`,
    title: input.documentCount === 0 ? "Your assistant is live, but it still needs source material." : "Your OAuth workspace is ready for the first chat.",
    description:
      input.documentCount === 0
        ? "We already created a personal assistant for this OAuth account. Upload a few files first, then ask the assistant against your own knowledge base instead of the shared seed data."
        : input.conversationCount === 0
          ? "Your knowledge base and assistant are ready. Start the first conversation to verify the OAuth workspace end to end."
          : "The OAuth workspace is already active. Jump back into chat or refine your assistant settings as needed.",
    pills: ["Personal assistant ready", `${input.documentCount} documents available`, `${input.conversationCount} conversations`],
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
    return {
      kicker: `${input.providerLabel} 工作区已就绪`,
      title: "你的个人知识库工作区已经创建好了。",
      description:
        input.assistantCount > 0
          ? "这个 OAuth 账号已经自动补齐个人知识库和助手。下一步先上传文档，让检索真正有内容可用。"
          : "这个 OAuth 账号已经自动补齐个人知识库。先上传文档，助手页里的检索和回答能力才会有真实资料可用。",
      pills: ["个人知识库", `已就绪助手 ${input.assistantCount} 个`, `已索引文档 ${input.documentCount} 份`],
      actions: [
        { label: "去上传文档", to: "/documents", tone: "primary" as const },
        { label: "打开助手页", to: "/assistant", tone: "secondary" as const }
      ]
    };
  }

  if (input.context === "assistant") {
    return {
      kicker: `${input.providerLabel} 助手已就绪`,
      title: "这个账号的专属助手已经配置完成。",
      description:
        input.documentCount === 0
          ? "助手和检索配置已经建好，但知识库还是空的。先上传文档，再回来微调 prompt 和检索参数。"
          : "助手已经可用。你可以在这里继续调整 prompt 和检索参数，然后回到聊天页完成第一次 OAuth 会话验证。",
      pills: ["助手已自动创建", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
      actions: [
        { label: input.documentCount === 0 ? "先上传文档" : "去聊天", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
        { label: "查看知识库", to: "/knowledge-base", tone: "secondary" as const }
      ]
    };
  }

  return {
    kicker: `${input.providerLabel} 对话工作区已就绪`,
    title: input.documentCount === 0 ? "助手已经可用，但还缺少可检索资料。" : "OAuth 工作区已经可以开始第一次对话了。",
    description:
      input.documentCount === 0
        ? "这个 OAuth 账号已经自动创建了专属助手。先上传几份文档，再开始提问，这样回答就会基于你自己的知识库，而不是共享 seed 数据。"
        : input.conversationCount === 0
          ? "你的知识库和助手已经准备好了。现在直接开始第一次对话，就能完整验证 OAuth 登录后的工作区链路。"
          : "当前 OAuth 工作区已经处于可用状态，你可以继续提问，或者回到知识库和助手页做进一步配置。",
    pills: ["专属助手已就绪", `可用文档 ${input.documentCount} 份`, `历史对话 ${input.conversationCount} 条`],
    actions: [
      { label: input.documentCount === 0 ? "去上传文档" : "开始聊天", to: input.documentCount === 0 ? "/documents" : "/", tone: "primary" as const },
      { label: "打开知识库", to: "/knowledge-base", tone: "secondary" as const }
    ]
  };
}
