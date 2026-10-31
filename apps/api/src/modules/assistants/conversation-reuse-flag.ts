/**
 * Whether an identical question in the same conversation may reuse the earlier
 * answer.
 *
 * Default off: when enabled, repeating a question returned the previous message
 * without creating a new turn, so asking twice looked like nothing happened.
 * The shortcut stays available for callers that explicitly opt in.
 */
export function isConversationReuseEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (env.ASK_CONVERSATION_REUSE ?? '').trim().toLowerCase() === 'true';
}
