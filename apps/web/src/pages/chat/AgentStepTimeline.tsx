import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { AgentStep } from '../../types/api';
import {
  resolveAgentStatusLabel,
  resolveAgentStepLabel,
  resolveAgentStepSummary,
  resolveAgentToolLabel
} from './agent-step-copy';

const STEP_REVEAL_INTERVAL_MS = 220;

export function AgentStepTimeline(input: {
  steps: AgentStep[];
  title: string;
  streaming?: boolean;
}) {
  const { t } = useI18n();
  const [visibleCount, setVisibleCount] = useState(() =>
    input.streaming === false
      ? input.steps.length
      : Math.min(1, input.steps.length)
  );

  useEffect(() => {
    if (input.streaming === false) {
      setVisibleCount(input.steps.length);
      return;
    }

    if (input.steps.length <= visibleCount) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, input.steps.length));
    }, STEP_REVEAL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [input.steps.length, input.streaming, visibleCount]);

  if (input.steps.length === 0) {
    return null;
  }

  const visibleSteps = input.steps.slice(0, visibleCount);

  return (
    <div className="mb-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
        {input.title}
      </div>
      <ol className="space-y-1.5">
        {visibleSteps.map((step) => {
          const toolLabel = resolveAgentToolLabel(step.toolName, t);
          return (
            <li
              className="agent-step-enter flex min-w-0 items-start gap-2 text-[11px] leading-5 text-[var(--app-text-secondary)]"
              key={step.name}
            >
              <span
                aria-hidden="true"
                className={[
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  step.status === 'completed'
                    ? 'bg-emerald-400'
                    : step.status === 'skipped'
                      ? 'bg-amber-300'
                      : 'animate-pulse bg-indigo-300'
                ].join(' ')}
              />
              <span className="min-w-0">
                <span className="font-medium text-[var(--app-text)]">
                  {resolveAgentStepLabel(step, t)}
                </span>
                {toolLabel ? (
                  <span className="ml-1.5 text-[var(--app-text-muted)]">
                    {toolLabel}
                  </span>
                ) : null}
                <span
                  className={[
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                    step.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : step.status === 'skipped'
                        ? 'bg-amber-500/10 text-amber-200'
                        : 'bg-indigo-500/10 text-indigo-200'
                  ].join(' ')}
                >
                  {resolveAgentStatusLabel(step.status, t)}
                </span>
                <span className="block truncate">
                  {resolveAgentStepSummary(step, t)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
