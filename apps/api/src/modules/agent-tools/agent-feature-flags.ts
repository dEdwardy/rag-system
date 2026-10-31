/**
 * Feature flags for the bounded LangGraph agent side path.
 *
 * Kept as a plain env reader, mirroring the existing
 * `isAuthDevDefaultUserModeEnabled` convention in `auth.constants.ts`, so the
 * side path stays switchable without introducing another runtime-config service.
 */

export const LANGGRAPH_AGENT_ENABLED_ENV_KEY = 'LANGGRAPH_AGENT_ENABLED';

/**
 * The LangGraph side path stays enabled unless it is explicitly turned off, so
 * existing behaviour and coverage are unchanged by this flag. Operators can
 * disable the experimental surface without a code change or redeploy of logic.
 */
export function isLangGraphAgentEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env[LANGGRAPH_AGENT_ENABLED_ENV_KEY]?.trim().toLowerCase();

  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') {
    return false;
  }

  return true;
}
