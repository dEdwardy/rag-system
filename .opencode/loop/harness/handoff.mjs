import { resolve } from "node:path";

import { formatDisplayTime } from "./queue.mjs";

export function buildHandoffPath({ handoffsDir, itemId, completedAt }) {
  return resolve(handoffsDir, `${toTimestampSlug(new Date(completedAt))}-${sanitizeFileToken(itemId)}.md`);
}

export function renderHandoff({
  item,
  session,
  message,
  promptText,
  assistantText,
  caveats,
  completedAt,
  finalStatus = "completed",
  verificationResult,
  verificationArtifactPath
}) {
  const resultText = assistantText.trim() ? assistantText.trim() : "(空)";
  const verificationLines = buildVerificationHandoffLines({
    item,
    verificationResult,
    verificationArtifactPath
  });
  const lines = [
    `# ${item.id}`,
    "",
    `- 标题: ${item.title ?? item.id}`,
    `- 状态: ${finalStatus}`,
    `- 代理: ${item.agent ?? "default"}`,
    `- 会话: ${session.id}`,
    `- 消息: ${message.info?.id ?? "unknown"}`,
    ...(item.startedAt ? [`- 开始: ${formatDisplayTime(item.startedAt)}`] : []),
    ...(item.resumedAt ? [`- 恢复: ${formatDisplayTime(item.resumedAt)}`] : []),
    ...(item.messageReceivedAt ? [`- 收到: ${formatDisplayTime(item.messageReceivedAt)}`] : []),
    `- 完成: ${formatDisplayTime(completedAt)}`,
    "",
    "## 结果",
    resultText,
    "",
    "## 提示词",
    "```text",
    promptText,
    "```",
    "",
    ...verificationLines,
    ...(caveats.length > 0 ? ["## 备注", ...caveats.map(caveat => `- ${caveat}`), ""] : [""])
  ];

  return `${lines.join("\n")}\n`;
}

function buildVerificationHandoffLines({ item, verificationResult, verificationArtifactPath }) {
  if (!verificationResult) {
    return [];
  }

  const lines = [
    "## 验证",
    `- Verdict: ${verificationResult.verdict ?? "unknown"}`,
    `- Summary: ${verificationResult.summary ?? "(none)"}`,
    ...(verificationArtifactPath ? [`- Artifact: ${verificationArtifactPath}`] : []),
    ...(verificationResult.failureCategory ? [`- Failure Category: ${verificationResult.failureCategory}`] : []),
    ...(verificationResult.failureCode ? [`- Failure Code: ${verificationResult.failureCode}`] : []),
    ...(verificationResult.routingReason ? [`- Routing Reason: ${verificationResult.routingReason}`] : []),
    ...(verificationResult.resumeWhen || item?.resumeWhen ? [`- Resume When: ${verificationResult.resumeWhen ?? item.resumeWhen}`] : []),
    ...(verificationResult.resumeHint || item?.resumeHint ? [`- Resume Hint: ${verificationResult.resumeHint ?? item.resumeHint}`] : [])
  ];

  if (verificationResult.failureDetail && typeof verificationResult.failureDetail === "object") {
    lines.push("- Failure Detail:");
    lines.push("```json");
    lines.push(JSON.stringify(verificationResult.failureDetail, null, 2));
    lines.push("```");
  }

  const operatorSummary = buildOperatorHandoffSummary({ item, verificationResult, verificationArtifactPath });
  if (operatorSummary.length > 0) {
    lines.push("");
    lines.push("## 接管摘要");
    lines.push(...operatorSummary.map(entry => `- ${entry}`));
  }

  lines.push("");
  return lines;
}

function buildOperatorHandoffSummary({ item, verificationResult, verificationArtifactPath }) {
  const verdict = verificationResult?.verdict;
  if (!["needs_replan", "failed", "needs_review", "blocked_external"].includes(verdict)) {
    return [];
  }

  const entries = [];
  if (verdict === "needs_replan") {
    entries.push(`当前尝试未满足 verifier 条件；原任务保留为 ${verdict} 证据项。`);
    if (verificationResult?.followupItemId) {
      entries.push(`自动 follow-up 已追加到 queue：${verificationResult.followupItemId}。`);
    }
    entries.push("优先查看 failure taxonomy 和 verification artifact，确认下一次自动修复是否对准失败点。");
  } else if (verdict === "failed") {
    entries.push("该任务已停止自动重试，需要人工处理后再决定是否恢复。");
    if (item?.retryPolicy?.maxAttempts) {
      entries.push(`当前 retryPolicy.maxAttempts=${item.retryPolicy.maxAttempts}。`);
    }
    entries.push("先查看 verification commands / artifacts / failure detail，再决定是修正验证契约还是修正实现。");
  } else if (verdict === "blocked_external") {
    entries.push("该任务已被 verifier 路由到 blocked_external，当前应等待外部依赖、权限或凭据恢复后再继续。");
    entries.push("优先检查 verification command / artifact 与 failure detail，确认阻塞点是否来自环境、凭据或外部系统，而不是实现本身。");
  } else {
    entries.push("该任务已被 verifier 路由到 needs_review，自动链路已暂停，等待人工判断后再恢复。");
    entries.push("优先检查 verification taxonomy、artifact 和 failure detail，判断是 verifier 合同过严还是实现边界需要人工确认。");
  }

  if (verificationResult?.failureCategory && verificationResult?.failureCode) {
    entries.push(`失败分类：${verificationResult.failureCategory}/${verificationResult.failureCode}。`);
  }
  if (verificationArtifactPath) {
    entries.push(`详细证据见 ${verificationArtifactPath}。`);
  }
  if (verificationResult?.resumeWhen || item?.resumeWhen) {
    entries.push(`恢复条件：${verificationResult?.resumeWhen ?? item.resumeWhen}`);
  }
  if (verificationResult?.resumeHint || item?.resumeHint) {
    entries.push(`恢复入口：${verificationResult?.resumeHint ?? item.resumeHint}`);
  }

  return entries;
}

function sanitizeFileToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toTimestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
